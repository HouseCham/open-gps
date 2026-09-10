#pragma once

// Real values live in config/secrets.h (gitignored).
// Copy config/secrets.example.h to config/secrets.h and fill in the
// values from your dashboard before flashing.
#include "config/secrets.h"

// If WIFI_SSID / WIFI_PASSWORD are absent, the build fails here — that's
// intentional. config/secrets.example.h declares them as empty strings so
// the build passes for users who only want GPS polling (no network). The
// runtime check in secrets_load() then rejects an empty ssid and
// transport_begin() logs "no WiFi configured".