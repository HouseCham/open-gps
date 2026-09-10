#pragma once

#include <Arduino.h>

// Device identity loaded from config/secrets.h at boot. The first three
// fields are required — empty strings trigger a loud error + reboot with
// backoff so the device never silently POSTs as "no identity". WiFi
// credentials are optional; if either is empty, transport_begin() fails
// gracefully (the device still polls GPS, just doesn't upload).
struct Secrets {
    const char* uuid;          // e.g. "aaaaaaaa-bbbb-cccc-dddd-000000000001"
    const char* api_key;       // 43-char base64url token from POST /api/v1/devices/:id/api-keys
    const char* wifi_ssid;     // 2.4 GHz WiFi network name
    const char* wifi_password; // WPA2 passphrase; can be empty for open networks
};

// Loads the secrets defined in config/secrets.h. Returns true if uuid + api_key
// are present (WiFi may be empty — caller checks wifi_ssid before connecting).
// false if uuid or api_key are missing/empty.
//
// Call once from setup() — the pointers stay valid for the lifetime of
// the firmware (they point into the .rodata of config/secrets.h).
bool secrets_load(Secrets& out);

// Prints a masked config summary: uuid length, key length and a
// key-prefix-suffix mask. WiFi SSID is printed in plain so it's visible
// in logs (it's not secret). Safe to leave on in production logs.
void secrets_print_diag(const Secrets& s);