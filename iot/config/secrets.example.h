#pragma once

// Device identity — replace with values from the dashboard after creating the device.
constexpr const char* DEVICE_UUID_FIRMWARE = "";  // e.g. "aaaaaaaa-bbbb-cccc-dddd-000000000001"
constexpr const char* DEVICE_API_KEY = "";         // 43-char base64url token from POST /api/v1/devices/:id/api-keys

// WiFi credentials — used by Stage 3 transport_begin().
// 2.4 GHz only (the ESP32-S3 radio is 2.4 GHz; 5 GHz networks won't work).
constexpr const char* WIFI_SSID = "";
constexpr const char* WIFI_PASSWORD = "";

// Fill these, then rename this file to secrets.h (it is gitignored).
// uuid and api_key are required (empty → boot error). WiFi fields can be
// empty if you only want GPS polling for now (transport_begin() will log
// a "no WiFi configured" message and skip uploads).
