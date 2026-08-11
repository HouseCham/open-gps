#include <Arduino.h>
#include <esp_task_wdt.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

#include "gps_board.h"
#include "location_payload.h"
#include "transport.h"
#include "config.h"
#include "secrets.h"
#include "telemetry.h"

static GpsBoard board;
static Secrets  secrets;
static bool     wifi_up = false;

static void logLine(const char* tag, const char* message) {
    Serial.printf("[%8lu][%-5s] %s\n", millis(), tag, message);
}

void setup() {
    // Rationale: Mask BOD to survive the initial high-current transient from unmanaged power rails.
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

#ifdef WAIT_FOR_SERIAL
    Serial.begin(115200);
    // A charger provides VBUS but no USB host. Never let USB TX backpressure
    // stall the application when the debug profile is used without a PC.
    Serial.setTxTimeoutMs(0);
    const unsigned long serialDeadline = millis() + 5000;
    while (!Serial && (long)(millis() - serialDeadline) < 0) delay(10);
    logLine("BOOT", "setup entered; brownout temporarily masked");
#endif

    // Rationale: Immediate PMU configuration block to collapse default high-draw states.
#ifdef WAIT_FOR_SERIAL
    logLine("BOARD", "starting PMU, modem UART, power-key, and AT bring-up");
#endif
    if (!board.begin()) {
        WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 1); // Restore BOD before halting
#ifndef WAIT_FOR_SERIAL
        Serial.begin(115200);
#endif
        telemetry_set_state(SystemState::ERR_BOARD);
        logLine("HALT", "hardware bring-up failed; rebooting in 5 s");
        const unsigned long restartAt = millis() + 5000;
        while ((long)(millis() - restartAt) < 0) {
            telemetry_tick();
            delay(10);
        }
        ESP.restart();
    }

    // Rationale: Rails are now stable. Restore hardware brownout protection immediately.
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 1);

#ifndef WAIT_FOR_SERIAL
    Serial.begin(115200);
#endif
    delay(3000);
    logLine("BOOT", "T-SIM7080G-S3 GPS bring-up");

    telemetry_set_state(SystemState::BOOTING);

    esp_task_wdt_init(WATCHDOG_TIMEOUT_S, true);
    esp_task_wdt_add(NULL);
    logLine("BOOT", "watchdog enabled");

    if (!secrets_load(secrets)) {
        logLine("ERR", "secrets missing");
        telemetry_set_state(SystemState::ERR_SECRETS);
        while (true) {
            telemetry_tick();
            esp_task_wdt_reset();
            delay(10);
        }
    }

    secrets_print_diag(secrets);

    telemetry_set_state(SystemState::CONNECTING_NETWORK);
    logLine("WIFI", "starting network connection");
    wifi_up = transport_begin(secrets);

    if (!wifi_up) {
        logLine("ERR", "WiFi connect failed; remaining in ERR_NETWORK until reset");
        telemetry_set_state(SystemState::ERR_NETWORK);
    } else {
        telemetry_set_state(SystemState::WAITING_GNSS_FIX);
        logLine("GNSS", "WiFi ready; waiting for a valid GNSS fix");
    }
}

void loop() {
    esp_task_wdt_reset();
    telemetry_tick();

    static unsigned long lastPoll = 0;
    static unsigned long lastIdle = 0;
    static unsigned long lastUpload = 0;
    static LocationPayload lastFix = {};
    static bool hasFix = false;

    const unsigned long now = millis();

    if (now - lastPoll >= FIX_POLL_MS) {
        lastPoll = now;
        if (board.pollFixPayload(lastFix)) {
            hasFix = true;
            if (wifi_up) telemetry_set_state(SystemState::GNSS_FIX_READY);
            Serial.printf("[%8lu][FIX  ] in_view=%lu used=%lu lat=%.6f lon=%.6f alt=%.1fm\n",
                          millis(),
                          (unsigned long)board.satellitesInView(),
                          (unsigned long)board.satellitesUsed(),
                          lastFix.latitude, lastFix.longitude, lastFix.altitude);
        } else {
            hasFix = false;
            if (wifi_up) telemetry_set_state(SystemState::WAITING_GNSS_FIX);
            if (now - lastIdle >= 10000) {
                lastIdle = now;
                String s = board.rawGnssState();
                if (s.length() == 0) {
                    if (wifi_up) telemetry_set_state(SystemState::GNSS_NO_RESPONSE);
                    logLine("GNSS", "modem returned no +CGNSINF response");
                } else {
                    if (wifi_up) telemetry_set_state(SystemState::WAITING_GNSS_FIX);
                    Serial.printf("[%8lu][STAT ] %s\n", millis(), s.c_str());
                }
            }
        }
    }

    if (!wifi_up || !hasFix) return;
    if (now - lastUpload < UPLOAD_PERIOD_S * 1000UL) return;
    lastUpload = now;

    telemetry_set_state(SystemState::UPLOADING_API);

    const TransportResult result = transport_post_locations(lastFix, secrets);
    switch (result) {
        case TransportResult::SENT:
            Serial.println(F("[UP  ] location sent"));
            telemetry_set_state(SystemState::WAITING_GNSS_FIX);
            telemetry_pulse_success();
            break;
        case TransportResult::WIFI_DISCONNECTED:
            Serial.println(F("[ERR ] WiFi disconnected; uploads stopped until reset"));
            wifi_up = false;
            telemetry_set_state(SystemState::ERR_NETWORK);
            break;
        case TransportResult::TRANSPORT_ERROR:
            Serial.println(F("[ERR ] API transport failed; retrying next cycle"));
            telemetry_set_state(SystemState::ERR_API_TRANSPORT);
            break;
        case TransportResult::HTTP_ERROR:
            Serial.println(F("[ERR ] API returned an HTTP error; retrying next cycle"));
            telemetry_set_state(SystemState::ERR_API_HTTP);
            break;
        case TransportResult::CONFIG_ERROR:
            Serial.println(F("[ERR ] API request could not be built"));
            telemetry_set_state(SystemState::ERR_API_CONFIG);
            break;
    }
}
