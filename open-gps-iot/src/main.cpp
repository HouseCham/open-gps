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
#include "sampling_policy.h"

static GpsBoard board;
static Secrets  secrets;
static bool     wifi_up = false;
static SamplingPolicy samplingPolicy({
    MIN_FIX_POLL_MS, MAX_FIX_POLL_MS, UNKNOWN_FIX_POLL_MS,
    STATIONARY_HEARTBEAT_MS, MAX_FIX_AGE_MS, TARGET_POINT_SPACING_M,
    MOVING_ENTER_MPS, MOVING_EXIT_MPS, MOTION_STATE_CONFIRMATION_COUNT
});

static void logLine(const __FlashStringHelper* tag, const __FlashStringHelper* message) {
    Serial.printf("[%8lu][", millis());
    Serial.print(tag);
    Serial.print(F("] "));
    Serial.println(message);
}

void setup() {
    // Rationale: Mask BOD to survive the initial high-current transient from unmanaged power rails.
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

#ifdef WAIT_FOR_SERIAL
    Serial.begin(115200);
    // A charger provides VBUS but no USB host. Never let USB TX backpressure
    // stall the application when the debug profile is used without a PC.
    Serial.setTxTimeoutMs(0);
    const unsigned long serialDeadline = millis() + SERIAL_WAIT_TIMEOUT_MS;
    while (!Serial && (long)(millis() - serialDeadline) < 0) delay(SETUP_IDLE_DELAY_MS);
    logLine(F("BOOT"), F("setup entered; brownout temporarily masked"));
#endif

    // Rationale: Immediate PMU configuration block to collapse default high-draw states.
#ifdef WAIT_FOR_SERIAL
    logLine(F("BOARD"), F("starting PMU, modem UART, power-key, and AT bring-up"));
#endif
    if (!board.begin()) {
        WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 1); // Restore BOD before halting
#ifndef WAIT_FOR_SERIAL
        Serial.begin(115200);
#endif
        telemetry_set_state(SystemState::ERR_BOARD);
        logLine(F("HALT"), F("hardware bring-up failed; rebooting in 5 s"));
        const unsigned long restartAt = millis() + BOARD_RESTART_DELAY_MS;
        while ((long)(millis() - restartAt) < 0) {
            telemetry_tick();
            delay(SETUP_IDLE_DELAY_MS);
        }
        ESP.restart();
    }

    // Rationale: Rails are now stable. Restore hardware brownout protection immediately.
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 1);

#ifndef WAIT_FOR_SERIAL
    Serial.begin(115200);
#endif
    delay(SETUP_HEADSTART_DELAY_MS);
    logLine(F("BOOT"), F("T-SIM7080G-S3 GPS bring-up"));

    telemetry_set_state(SystemState::BOOTING);

    if (esp_task_wdt_init(WATCHDOG_TIMEOUT_S, true) != ESP_OK ||
        esp_task_wdt_add(NULL) != ESP_OK) {
        logLine(F("HALT"), F("watchdog setup failed; rebooting"));
        ESP.restart();
    }
    logLine(F("BOOT"), F("watchdog enabled"));

    if (!secrets_load(secrets)) {
        logLine(F("ERR"), F("secrets missing"));
        telemetry_set_state(SystemState::ERR_SECRETS);
        while (true) {
            telemetry_tick();
            esp_task_wdt_reset();
            delay(SETUP_IDLE_DELAY_MS);
        }
    }

    secrets_print_diag(secrets);

    telemetry_set_state(SystemState::CONNECTING_NETWORK);
    logLine(F("CELL"), F("starting Hologram cellular connection"));
    wifi_up = transport_cellular_begin();

    if (!wifi_up) {
        logLine(F("ERR"), F("cellular connect failed; remaining in ERR_NETWORK until reset"));
        telemetry_set_state(SystemState::ERR_NETWORK);
    } else {
        if (!board.enableGps()) {
            logLine(F("ERR"), F("GNSS enable failed"));
            wifi_up = false;
        }
        telemetry_set_state(SystemState::WAITING_GNSS_FIX);
        logLine(F("GNSS"), F("cellular ready; waiting for a valid GNSS fix"));
    }
}

void loop() {
    esp_task_wdt_reset();
    telemetry_tick();

    static unsigned long lastIdle = 0;
    static LocationPayload lastFix = {};
    static bool hasFix = false;
    static SamplingDecision pendingDecision = {UNKNOWN_FIX_POLL_MS, false,
                                               UploadReason::NONE, MotionState::UNKNOWN};

    const unsigned long now = millis();

    if (samplingPolicy.fixDue(now)) {
        if (board.pollFixPayload(lastFix)) {
            hasFix = true;
            pendingDecision = samplingPolicy.onFix(now, lastFix);
            if (wifi_up) telemetry_set_state(SystemState::GNSS_FIX_READY);
            Serial.printf("[%8lu][SAMPLE] state=%u v=%.2fm/s poll=%lums upload=%u reason=%u\n",
                          now, static_cast<unsigned>(pendingDecision.motionState),
                          lastFix.speed_mps, (unsigned long)pendingDecision.nextFixPollMs,
                          pendingDecision.shouldUpload ? 1U : 0U,
                          static_cast<unsigned>(pendingDecision.uploadReason));
            Serial.printf("[%8lu][FIX  ] in_view=%lu used=%lu lat=%.6f lon=%.6f alt=%.1fm\n",
                           millis(),
                          (unsigned long)board.satellitesInView(),
                          (unsigned long)board.satellitesUsed(),
                          lastFix.latitude, lastFix.longitude, lastFix.altitude);
        } else {
            hasFix = false;
            if (wifi_up) telemetry_set_state(SystemState::WAITING_GNSS_FIX);
            if (now - lastIdle >= GNSS_STATUS_LOG_INTERVAL_MS) {
                lastIdle = now;
                char status[GNSS_STATUS_BUFFER_SIZE];
                if (board.rawGnssState(status, sizeof(status)) == 0) {
                    if (wifi_up) telemetry_set_state(SystemState::GNSS_NO_RESPONSE);
                    logLine(F("GNSS"), F("modem returned no +CGNSINF response"));
                } else {
                    if (wifi_up) telemetry_set_state(SystemState::WAITING_GNSS_FIX);
                    Serial.printf("[%8lu][STAT ] %s\n", millis(), status);
                }
            }
        }
    }

    if (!wifi_up || !hasFix) return;
    // The policy owns cadence; this fix remains pending until SENT is reported.
    if (!pendingDecision.shouldUpload) return;
    pendingDecision.shouldUpload = false;

    telemetry_set_state(SystemState::UPLOADING_API);

    const unsigned long radioOffAt = millis();
    if (!board.disableGps()) {
        Serial.println(F("[ERR ] GNSS disable failed; upload skipped"));
        telemetry_set_state(SystemState::ERR_API_TRANSPORT);
        return;
    }
    const TransportResult result = transport_post_locations(lastFix, secrets);
    const bool gpsEnabled = board.enableGps();
    Serial.printf("[%8lu][RADIO] GNSS off %lums reenable=%u\n", millis(),
                  millis() - radioOffAt, gpsEnabled ? 1U : 0U);
    if (!gpsEnabled) {
        Serial.println(F("[ERR ] GNSS re-enable failed"));
        telemetry_set_state(SystemState::ERR_API_TRANSPORT);
    } else {
        samplingPolicy.notifyGpsReenabled(millis());
    }
    switch (result) {
        case TransportResult::SENT:
            Serial.println(F("[UP  ] location sent"));
            samplingPolicy.onUploadResult(millis(), lastFix, true);
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
