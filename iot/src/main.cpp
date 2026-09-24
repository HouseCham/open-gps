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
#include "charge_mode_policy.h"
#include "cellular_manager.h"
#include "persistent_fix_store.h"
#include "fix_record.h"
#include "vbat_sag.h"
#include "battery_policy.h"
#include "power_manager.h"

static GpsBoard board;
static Secrets  secrets;
static bool     cellularReady = false;
static CellularManager cellularManager;
static bool chargeModeRequested = false;
static ChargeModePolicy chargePolicy(VBUS_PRESENT_THRESHOLD_MV, VBUS_ABSENT_THRESHOLD_MV,
                                      VBUS_STATE_DEBOUNCE_MS);
static PersistentFixStore fixStore;
static uint32_t bootId = 0;
static bool queueReady = false;
static uint32_t lastRadioOpenMs = 0;
static bool radioHasOpened = false;
static VbatSagTracker vbatSag;
static uint32_t lastVbatSampleMs = 0;
static uint32_t lastVbatReportMs = 0;
static BatteryPolicy batteryPolicy(LOW_BATTERY_ENTER_MV, LOW_BATTERY_EXIT_MV);
static PowerManager powerManager({POWER_MODEM_DTR, POWER_DEEP_SLEEP,
                                  POWER_PSM_EDRX, POWER_STATIONARY_DWELL_MS});
static PowerProfile lastPowerProfile = PowerProfile::MOVING;
static uint32_t powerProfileSinceMs = 0;

// Derive the power profile from what the loop already knows. No actuators:
// POWER_* flags in config.h are all false until Hologram + HIL sign-off.
static PowerProfile currentPowerProfile(MotionState motion) {
    if (batteryPolicy.lowBattery()) return PowerProfile::LOW_BATTERY;
    if (!cellularReady) return PowerProfile::NO_NETWORK;
    if (motion == MotionState::STATIONARY) return PowerProfile::STATIONARY;
    return PowerProfile::MOVING;
}

static const char* systemStateName(SystemState s) {
    switch (s) {
        case SystemState::BOOTING: return "BOOTING";
        case SystemState::CONNECTING_NETWORK: return "CONNECTING";
        case SystemState::WAITING_GNSS_FIX: return "WAIT_FIX";
        case SystemState::GNSS_FIX_READY: return "FIX_OK";
        case SystemState::GNSS_NO_RESPONSE: return "GNSS_NORESP";
        case SystemState::UPLOADING_API: return "UPLOAD";
        case SystemState::ERR_BOARD: return "ERR_BOARD";
        case SystemState::ERR_SECRETS: return "ERR_SECRETS";
        case SystemState::ERR_NETWORK: return "ERR_NET";
        case SystemState::ERR_API_TRANSPORT: return "ERR_XPORT";
        case SystemState::ERR_API_HTTP: return "ERR_HTTP";
        case SystemState::ERR_API_CONFIG: return "ERR_CFG";
    }
    return "?";
}

// Phase 3.4: 1 Hz VBAT sample tagged with SystemState; every VBAT_REPORT_MS
// print min/avg/sag per state so a serial capture ranks load without a
// current probe. Sag = highest sample seen - state min (mV).
static void vbatSagTick(uint32_t now) {
    if (now - lastVbatSampleMs >= VBAT_SAMPLE_MS) {
        lastVbatSampleMs = now;
        const uint16_t mv = board_pmu().getBattVoltage();
        vbatSag.sample(static_cast<uint8_t>(telemetry_current_state()), mv);
        if (batteryPolicy.update(mv)) {
            Serial.printf(PSTR("[%8lu][BATT] low_battery=%u v=%umV\n"), now,
                          batteryPolicy.lowBattery() ? 1U : 0U, mv);
        }
    }
    if (lastVbatReportMs == 0) lastVbatReportMs = now;
    if (now - lastVbatReportMs < VBAT_REPORT_MS || !vbatSag.hasSamples()) return;
    lastVbatReportMs = now;
    Serial.printf(PSTR("[%8lu][VBAT] rest=%umV samples=%u\n"), now,
                  vbatSag.restBaselineMv(), (unsigned)vbatSag.totalSamples());
    for (uint8_t s = 0; s < vbatSag.stateCount(); ++s) {
        const VbatStats* st = vbatSag.stats(s);
        if (!st || st->count == 0) continue;
        Serial.printf(PSTR("[VBAT]  %-10s n=%u min=%u avg=%u max=%u sag=%umV\n"),
                      systemStateName(static_cast<SystemState>(s)),
                      (unsigned)st->count, st->minMv, st->avgMv(), st->maxMv,
                      vbatSag.sagMv(s));
    }
}

static uint16_t chargeModeVbusMv() {
    // AXP2101 digital VBUS status is authoritative; voltage is the fallback
    // because some revisions briefly report zero from the ADC after startup.
    return board.isVbusPresent() ? VBUS_PRESENT_THRESHOLD_MV : board.vbusVoltageMv();
}

static void logLine(const __FlashStringHelper* tag, const __FlashStringHelper* message);

[[noreturn]] static void runChargeOnlyMode() {
    if (!board.enterChargeOnlyPowerState()) {
        logLine(F("ERR"), F("charge-only rail shutdown failed; restarting"));
        ESP.restart();
    }
    GpsBoard::ChargerState previous = GpsBoard::ChargerState::UNKNOWN;
    uint32_t nextPollMs = millis();
    for (;;) {
        esp_task_wdt_reset();
        const uint32_t now = millis();
        if (static_cast<uint32_t>(now - nextPollMs) < CHARGE_MODE_POLL_MS) {
            yield();
            continue;
        }
        nextPollMs = now;
        if (!chargePolicy.update(now, chargeModeVbusMv())) {
            logLine(F("CHARGE"), F("VBUS removed; restarting tracker"));
            ESP.restart();
        }
        const GpsBoard::ChargerState state = board.chargerState();
        if (state != previous) {
            board.setChargeIndicator(state);
            previous = state;
        }
    }
}
static SamplingPolicy samplingPolicy({
    MIN_FIX_POLL_MS, MAX_FIX_POLL_MS, UNKNOWN_FIX_POLL_MS,
    STATIONARY_HEARTBEAT_MS, MAX_FIX_AGE_MS, TARGET_POINT_SPACING_M,
    MOVING_ENTER_MPS, MOVING_EXIT_MPS, MOTION_STATE_CONFIRMATION_COUNT,
    MAX_ACCURACY_M, MIN_SATELLITES, MAX_SPEED_MPS
});

static void logLine(const __FlashStringHelper* tag, const __FlashStringHelper* message) {
    Serial.printf(PSTR("[%8lu]["), millis());
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
    if (!board.beginPmuOnly()) {
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

    if (esp_task_wdt_init(WATCHDOG_TIMEOUT_S, true) != ESP_OK ||
        esp_task_wdt_add(NULL) != ESP_OK) {
        logLine(F("HALT"), F("watchdog setup failed; rebooting"));
        ESP.restart();
    }

    if (CHARGE_MODE_ENABLED) {
        const uint32_t decisionStarted = millis();
        // Preserve the first valid VBUS sample. XPowersLib can transiently
        // report zero while its ADC/status registers settle after begin().
        const uint16_t startupVbusMv = chargeModeVbusMv();
        // update() mutates the debounce state; present() is the authoritative result.
        (void)chargePolicy.update(decisionStarted, startupVbusMv);
        while (static_cast<uint32_t>(millis() - decisionStarted) < VBUS_STATE_DEBOUNCE_MS) {
            esp_task_wdt_reset();
            yield();
        }
        (void)chargePolicy.update(millis(), startupVbusMv);
        if (chargePolicy.present()) runChargeOnlyMode();
    }
    if (!board.beginTrackerHardware()) {
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

    bootId = esp_random();
    queueReady = fixStore.begin(FIX_QUEUE_CAPACITY);
    if (!queueReady)
        logLine(F("ERR"), F("fix queue unavailable; points may be lost"));

    telemetry_set_state(SystemState::CONNECTING_NETWORK);
    logLine(F("CELL"), F("starting Hologram cellular connection"));
    cellularReady = transportCellularBegin();
    cellularManager.begin(cellularReady);

    if (!cellularReady) {
        logLine(F("ERR"), F("cellular connect failed; GNSS continues"));
        telemetry_set_state(SystemState::ERR_NETWORK);
    }
    if (!board.enableGps()) logLine(F("ERR"), F("GNSS enable failed"));
    telemetry_set_state(SystemState::WAITING_GNSS_FIX);
    logLine(F("GNSS"), F("waiting for a valid GNSS fix"));
}

void loop() {
    esp_task_wdt_reset();
    if (CHARGE_MODE_ENABLED && chargePolicy.update(millis(), chargeModeVbusMv())) {
        chargeModeRequested = true;
    }
    if (chargeModeRequested) ESP.restart();
    telemetry_tick();

    static unsigned long lastIdle = 0;
    static LocationPayload lastFix = {};
    static SamplingDecision pendingDecision = {UNKNOWN_FIX_POLL_MS, false,
                                               UploadReason::NONE, MotionState::UNKNOWN,
                                               false};
    static FixRecord batch[BATCH_MAX_ITEMS];
    static uint32_t lastQueueLogMs = 0;

    const unsigned long now = millis();
    vbatSagTick(now);

    const PowerProfile profile = currentPowerProfile(samplingPolicy.motionState());
    if (profile != lastPowerProfile) {
        lastPowerProfile = profile;
        powerProfileSinceMs = now;
        const PowerDecision pd = powerManager.decide(profile, now, powerProfileSinceMs);
        Serial.printf(PSTR("[%8lu][PWR ] profile=%s dtr=%u deep=%u psm=%u up=%u\n"),
                      now, PowerManager::profileName(profile),
                      pd.allowModemDtr ? 1U : 0U, pd.allowDeepSleep ? 1U : 0U,
                      pd.allowPsmEdrx ? 1U : 0U, pd.wantUpload ? 1U : 0U);
    }

    cellularManager.tick(now);
    cellularReady = cellularManager.ready();

    if (samplingPolicy.fixDue(now)) {
        if (board.pollFixPayload(lastFix)) {
            pendingDecision = samplingPolicy.onFix(now, lastFix);
            if (!pendingDecision.fixAccepted) {
                telemetry_set_state(SystemState::WAITING_GNSS_FIX);
                Serial.println(F("[REJECT] fix failed validation (stagnant/quality/jump)"));
            } else {
                telemetry_set_state(SystemState::GNSS_FIX_READY);
                Serial.printf(PSTR("[%8lu][SAMPLE] state=%u v=%.2fm/s poll=%lums upload=%u reason=%u\n"),
                              now, static_cast<unsigned>(pendingDecision.motionState),
                              lastFix.speed_mps, (unsigned long)pendingDecision.nextFixPollMs,
                              pendingDecision.shouldUpload ? 1U : 0U,
                              static_cast<unsigned>(pendingDecision.uploadReason));
                Serial.printf(PSTR("[%8lu][FIX  ] in_view=%lu used=%lu lat=%.6f lon=%.6f alt=%.1fm\n"),
                               millis(),
                              (unsigned long)board.satellitesInView(),
                              (unsigned long)board.satellitesUsed(),
                              lastFix.latitude, lastFix.longitude, lastFix.altitude);

                // Enqueue accepted fixes BEFORE any network attempt so a coverage
                // gap never loses the point (audit-fix-plan Phase 2).
                if (pendingDecision.shouldUpload && queueReady) {
                    LocationPayload enriched = lastFix;
                    enriched.signal_strength = -1;
                    const uint16_t batt_mv = board_pmu().getBattVoltage();
                    const double batt_v = batt_mv / 1000.0;
                    if (batt_v > 0.0 && batt_v <= 6.0) enriched.battery_voltage = batt_v;
                    const int csq = board_modem().getSignalQuality();
                    if (csq >= 0 && csq <= 31) enriched.signal_strength = csq;

                    FixRecord record{};
                    if (locationPayloadToFixRecord(enriched, 0, bootId, record) &&
                        fixStore.push(record)) {
                        samplingPolicy.onUploadResult(now, lastFix, true);
                        Serial.printf(PSTR("[%8lu][QUEUE] enqueued seq=%lu size=%lu/%lu\n"),
                                      now, (unsigned long)record.sequence_id,
                                      (unsigned long)fixStore.size(),
                                      (unsigned long)fixStore.capacity());
                    } else {
                        Serial.println(F("[ERR ] queue push failed; point dropped"));
                    }
                    pendingDecision.shouldUpload = false;
                }
            }
        } else {
            telemetry_set_state(SystemState::WAITING_GNSS_FIX);
            if (now - lastIdle >= GNSS_STATUS_LOG_INTERVAL_MS) {
                lastIdle = now;
                char status[GNSS_STATUS_BUFFER_SIZE];
                if (board.rawGnssState(status, sizeof(status)) == 0) {
                    telemetry_set_state(SystemState::GNSS_NO_RESPONSE);
                    logLine(F("GNSS"), F("modem returned no +CGNSINF response"));
                } else {
                    telemetry_set_state(SystemState::WAITING_GNSS_FIX);
            Serial.printf(PSTR("[%8lu][STAT ] %s\n"), millis(), status);
                }
            }
        }
    }

    if (queueReady && fixStore.lostCount() > 0 &&
        static_cast<uint32_t>(now - lastQueueLogMs) >= GNSS_STATUS_LOG_INTERVAL_MS) {
        lastQueueLogMs = now;
        Serial.printf(PSTR("[%8lu][QUEUE] size=%lu lost=%lu\n"), now,
                      (unsigned long)fixStore.size(),
                      (unsigned long)fixStore.lostCount());
    }

    // Drain the queue when the radio gate allows it — independent of whether a
    // fresh fix arrived this pass (backlog after an outage must flush too).
    if (!queueReady || !cellularReady || fixStore.size() == 0) return;
    if (!radioDue(now, fixStore.size(), lastRadioOpenMs, radioHasOpened,
                  samplingPolicy.motionState(), UPLOAD_BATCH_MIN_ITEMS,
                  UPLOAD_FLUSH_MS_MOVING, UPLOAD_FLUSH_MS_STATIONARY)) {
        return;
    }
    lastRadioOpenMs = now;
    radioHasOpened = true;

    const size_t toSend = fixStore.peek(batch, BATCH_MAX_ITEMS);
    if (toSend == 0) return;

    telemetry_set_state(SystemState::UPLOADING_API);
    // The 1 Hz sampler never sees UPLOADING_API (POST blocks inside this
    // same loop pass) — take explicit samples across the radio window so the
    // [VBAT] table ranks the actual load.
    vbatSag.sample(static_cast<uint8_t>(SystemState::UPLOADING_API),
                   board_pmu().getBattVoltage());

    const unsigned long radioOffAt = millis();
    if (!board.disableGps()) {
        Serial.println(F("[ERR ] GNSS disable failed; upload skipped"));
        telemetry_set_state(SystemState::ERR_API_TRANSPORT);
        return;
    }
    const TransportResult result = transportPostBatch(batch, toSend, secrets);
    vbatSag.sample(static_cast<uint8_t>(SystemState::UPLOADING_API),
                   board_pmu().getBattVoltage());
    cellularManager.reportTransportResult(result);
    const bool gpsEnabled = board.enableGps();
    Serial.printf(PSTR("[%8lu][RADIO] GNSS off %lums reenable=%u\n"), millis(),
                  millis() - radioOffAt, gpsEnabled ? 1U : 0U);
    if (!gpsEnabled) {
        Serial.println(F("[ERR ] GNSS re-enable failed"));
        telemetry_set_state(SystemState::ERR_API_TRANSPORT);
    } else {
        samplingPolicy.notifyGpsReenabled(millis());
    }
    switch (result) {
        case TransportResult::SENT: {
            // 201 = every item accepted or permanently rejected (validation);
            // safe to drop the whole peeked prefix. Backend is idempotent by
            // sequence_id if a crash re-sends after a partial ack.
            const size_t acked = fixStore.ackFront(toSend);
            Serial.printf(PSTR("[UP  ] batch sent (%u/%u acked), queue=%lu\n"),
                          (unsigned)acked, (unsigned)toSend,
                          (unsigned long)fixStore.size());
            if (acked > 0) {
                LocationPayload newest{};
                locationPayloadFromFixRecord(newest, batch[acked - 1]);
                samplingPolicy.onUploadResult(millis(), newest, true);
            }
            telemetry_set_state(SystemState::WAITING_GNSS_FIX);
            telemetry_pulse_success();
            break;
        }
        case TransportResult::TRANSPORT_ERROR:
            Serial.println(F("[ERR ] API transport failed; points stay queued"));
            telemetry_set_state(SystemState::ERR_API_TRANSPORT);
            break;
        case TransportResult::HTTP_CLIENT_ERROR:
        case TransportResult::HTTP_SERVER_ERROR:
        case TransportResult::TIMEOUT:
            Serial.println(F("[ERR ] API returned an HTTP error; points stay queued"));
            telemetry_set_state(SystemState::ERR_API_HTTP);
            break;
        case TransportResult::CONFIG_ERROR:
            Serial.println(F("[ERR ] API request could not be built"));
            telemetry_set_state(SystemState::ERR_API_CONFIG);
            break;
    }
}
