#pragma once

#include <stddef.h>
#include <stdint.h>

// Adaptive sampling: intervals are milliseconds; speeds are metres/second.
constexpr uint32_t TARGET_POINT_SPACING_M = 25;
constexpr uint32_t MIN_FIX_POLL_MS = 1000;
constexpr uint32_t MAX_FIX_POLL_MS = 15000;
constexpr uint32_t UNKNOWN_FIX_POLL_MS = 2000;
constexpr uint32_t STATIONARY_HEARTBEAT_MS = 300000;
constexpr uint32_t MAX_FIX_AGE_MS = 30000;
constexpr float MOVING_ENTER_MPS = 1.5f;
constexpr float MOVING_EXIT_MPS = 0.8f;
constexpr uint8_t MOTION_STATE_CONFIRMATION_COUNT = 3;
// Fix quality gates (0 disables each check); applied only when the field is
// known — accuracy_m/satellites_used of 0 mean "unknown" and skip the gate.
constexpr double MAX_ACCURACY_M = 50.0;
constexpr uint16_t MIN_SATELLITES = 4;
// Implied speed vs previous accepted fix: glitch/teleport guard, not a vehicle
// limit (500 m/s ≈ 1800 km/h).
constexpr double MAX_SPEED_MPS = 500.0;
constexpr uint32_t GNSS_STATUS_LOG_INTERVAL_MS = 10000;
constexpr uint32_t SERIAL_WAIT_TIMEOUT_MS = 5000;
constexpr uint32_t BOARD_RESTART_DELAY_MS = 5000;
constexpr uint32_t SETUP_HEADSTART_DELAY_MS = 3000;
constexpr uint32_t GNSS_STATUS_POLL_DELAY_MS = 10;
constexpr uint32_t SETUP_IDLE_DELAY_MS = 10;
constexpr size_t GNSS_STATUS_BUFFER_SIZE = 128;

// ----- USB-C charge-only mode -----
#ifdef WAIT_FOR_SERIAL
// The debug USB profile must keep tracking alive so serial diagnostics work
// while the board is powered from the USB host.
constexpr bool CHARGE_MODE_ENABLED = false;
#else
constexpr bool CHARGE_MODE_ENABLED = true;
#endif
constexpr uint32_t VBUS_PRESENT_THRESHOLD_MV = 4500;
constexpr uint32_t VBUS_ABSENT_THRESHOLD_MV = 4000;
constexpr uint32_t VBUS_STATE_DEBOUNCE_MS = 2000;
constexpr uint32_t CHARGE_MODE_POLL_MS = 1000;
constexpr bool CHARGE_MODE_USE_LIGHT_SLEEP = false;

// ----- Watchdog -----
// If the ESP32 loop stalls for more than this many seconds, the hardware watchdog reboots.
constexpr uint32_t WATCHDOG_TIMEOUT_S = 30;
constexpr uint32_t CELLULAR_RECOVERY_BASE_MS = 30000;
constexpr uint32_t CELLULAR_RECOVERY_MAX_MS = 900000;
constexpr uint8_t CELLULAR_RECOVERY_MAX_ATTEMPTS = 6;
constexpr uint32_t CELLULAR_OPERATION_TIMEOUT_MS = 10000;

// ----- Offline fix queue (Phase 2) -----
// 2048 × 64 B = 128 KB — fits the 896 KB spiffs partition in huge_app.csv.
// ~3 h of points at the 5 s stationary-ish cadence; ~34 min at the 1 s floor.
// When full, the oldest record is dropped (audit-fix-plan: keep recent).
constexpr size_t FIX_QUEUE_CAPACITY = 2048;
// Backend hard limit (dto.MaxBatchItems).
constexpr size_t BATCH_MAX_ITEMS = 20;

// ----- Radio open policy (Phase 3.3) -----
// Open the modem when the queue is full enough or the oldest wait exceeded
// the motion-dependent flush interval — not on every accepted fix.
constexpr size_t UPLOAD_BATCH_MIN_ITEMS = 20;
constexpr uint32_t UPLOAD_FLUSH_MS_MOVING = 30000;
constexpr uint32_t UPLOAD_FLUSH_MS_STATIONARY = 60000;

// ----- VBAT sag proxy (Phase 3.4) -----
// AXP2101 has no current ADC: sample battery voltage per SystemState and
// report min/avg + sag vs the highest observed sample (rest/OCV proxy).
// Absolute mA / autonomy still needs an external analyzer; this ranks load.
constexpr uint32_t VBAT_SAMPLE_MS = 1000;
constexpr uint32_t VBAT_REPORT_MS = 30000;

// ----- Low-battery hysteresis (Phase 3.6a) -----
// Enter LOW_BATTERY at or below enter; leave only at or above exit so the
// flag cannot chatter around one threshold. Deep-sleep action stays off
// until Phase 3.5 + Hologram timers are validated.
constexpr uint16_t LOW_BATTERY_ENTER_MV = 3400;
constexpr uint16_t LOW_BATTERY_EXIT_MV = 3600;

// ----- Power manager flags (Phase 3.5) -----
// All actuators ship disabled. Flip one only after its HIL gate:
//   POWER_MODEM_DTR   — modem sleep via DTR when idle (safest first switch)
//   POWER_DEEP_SLEEP  — ESP32 deep sleep between stationary heartbeats
//   POWER_PSM_EDRX    — last: needs Hologram-granted timers + wake 10/10
constexpr bool POWER_MODEM_DTR = false;
constexpr bool POWER_DEEP_SLEEP = false;
constexpr bool POWER_PSM_EDRX = false;
// Minimum time in STATIONARY/NO_NETWORK/LOW_BATTERY before deep sleep is
// even considered (when POWER_DEEP_SLEEP is true).
constexpr uint32_t POWER_STATIONARY_DWELL_MS = 60000;
