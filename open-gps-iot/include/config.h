#pragma once

#include <stdint.h>

// ----- API endpoint -----
// Replace with your actual backend URL before deploying.
// The device resolves this via DNS over WiFi or cellular.
// Do not include a trailing slash or path — the transport module appends
// the locations path automatically.
constexpr const char* API_HOST = "https://gps-tracker.local";
constexpr const char* CELLULAR_APN = "hologram";

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
constexpr uint32_t GNSS_STATUS_LOG_INTERVAL_MS = 10000;
constexpr uint32_t SERIAL_WAIT_TIMEOUT_MS = 5000;
constexpr uint32_t BOARD_RESTART_DELAY_MS = 5000;
constexpr uint32_t SETUP_HEADSTART_DELAY_MS = 3000;
constexpr uint32_t GNSS_STATUS_POLL_DELAY_MS = 10;
constexpr uint32_t SETUP_IDLE_DELAY_MS = 10;
constexpr size_t GNSS_STATUS_BUFFER_SIZE = 128;

// ----- Watchdog -----
// If the ESP32 loop stalls for more than this many seconds, the hardware watchdog reboots.
constexpr uint32_t WATCHDOG_TIMEOUT_S = 30;
