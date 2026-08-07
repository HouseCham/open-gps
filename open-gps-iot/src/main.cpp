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
        Serial.begin(115200);
        Serial.println(F("[HALT] Hardware bring-up failed; rebooting in 5 s"));
        Serial.flush();
        delay(5000);
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
            Serial.printf("[FIX ] sats=%lu  lat=%.6f  lon=%.6f  alt=%.1fm\n",
                          (unsigned long)board.satellitesUsed(),
                          lastFix.latitude, lastFix.longitude, lastFix.altitude);
        } else if (now - lastIdle >= 10000) {
            lastIdle = now;
            String s = board.rawGnssState();
            if (s.length() == 0) {
                Serial.println(F("[....] modem returned no +CGNSINF"));
            } else {
                Serial.print(F("[STAT] ")); Serial.println(s);
            }
        }
    }

    if (!wifi_up || !hasFix) return;
    if (now - lastUpload < UPLOAD_PERIOD_S * 1000UL) return;
    lastUpload = now;

    telemetry_set_state(SystemState::UPLOADING_API);

    if (transport_post_locations(lastFix, secrets)) {
        Serial.println(F("[UP  ] location sent"));
        telemetry_set_state(SystemState::WAITING_GNSS_FIX);
    } else {
        Serial.println(F("[ERR ] upload failed; remaining in ERR_API_FAIL until reset"));
        telemetry_set_state(SystemState::ERR_API_FAIL);
    }
}