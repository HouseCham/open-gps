#pragma once

#include <stdint.h>

// ----- API endpoint -----
// Replace with your actual backend URL before deploying.
// The device resolves this via DNS over WiFi or cellular.
// Do not include a trailing slash or path — the transport module appends
// the locations path automatically.
constexpr const char* API_HOST = "https://gps-tracker.local";
constexpr const char* CELLULAR_APN = "hologram";

// ----- GPS polling -----
constexpr uint32_t FIX_POLL_MS = 2000;  // how often loop() checks for a new fix

// ----- Upload cadence -----
// How often (in seconds) the device attempts to POST a location to the API.
// 10 s is a dev value; production will want 30–300 s to conserve battery/data.
constexpr uint32_t UPLOAD_PERIOD_S = 10;

// ----- Watchdog -----
// If the ESP32 loop stalls for more than this many seconds, the hardware watchdog reboots.
constexpr uint32_t WATCHDOG_TIMEOUT_S = 30;
