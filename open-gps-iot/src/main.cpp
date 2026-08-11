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

void setup() {
    // Rationale: Mask BOD to survive the initial high-current transient from unmanaged power rails.
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

    // Rationale: Immediate PMU configuration block to collapse default high-draw states.
    if (!board.begin()) {
        WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 1); // Restore BOD before halting
        telemetry_set_state(SystemState::ERR_BOARD);
        Serial.begin(115200);
        Serial.println(F("[HALT] Hardware bring-up failed; rebooting in 5 s"));
        Serial.flush();
        const unsigned long restartAt = millis() + 5000;
        while ((long)(millis() - restartAt) < 0) {
            telemetry_tick();
            delay(10);
        }
        ESP.restart();
    }

    // Rationale: Rails are now stable. Restore hardware brownout protection immediately.
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 1);

    Serial.begin(115200);
    delay(3000);
    Serial.println(F("\n[BOOT] T-SIM7080G-S3 GPS bring-up"));
    Serial.flush();

    telemetry_set_state(SystemState::BOOTING);

    esp_task_wdt_init(WATCHDOG_TIMEOUT_S, true);
    esp_task_wdt_add(NULL);

    if (!secrets_load(secrets)) {
        Serial.println(F("[ERR ] secrets missing"));
        Serial.flush();
        telemetry_set_state(SystemState::ERR_SECRETS);
        while (true) {
            telemetry_tick();
            esp_task_wdt_reset();
            delay(10);
        }
    }

    secrets_print_diag(secrets);
    Serial.flush();

    telemetry_set_state(SystemState::CONNECTING_NETWORK);
    wifi_up = transport_begin(secrets);

    if (!wifi_up) {
        Serial.println(F("[ERR ] WiFi connect failed; remaining in ERR_NETWORK until reset"));
        telemetry_set_state(SystemState::ERR_NETWORK);
    } else {
        telemetry_set_state(SystemState::WAITING_GNSS_FIX);
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
            Serial.printf("[FIX ] sats=%lu  lat=%.6f  lon=%.6f  alt=%.1fm\n",
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
                    Serial.println(F("[....] modem returned no +CGNSINF"));
                } else {
                    if (wifi_up) telemetry_set_state(SystemState::WAITING_GNSS_FIX);
                    Serial.print(F("[STAT] ")); Serial.println(s);
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
