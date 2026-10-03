#include "secrets.h"

// Real values live in config/secrets.h (gitignored). Copy
// config/secrets.example.h → config/secrets.h and fill in the values.
// UUID + API key are required (empty → boot error). WiFi fields can be
// empty for GPS-only mode (transport_begin() logs a helpful message).
#include "secrets_data.h"

bool secrets_load(Secrets& out) {
    if (DEVICE_UUID_FIRMWARE[0] == '\0') return false;
    if (DEVICE_API_KEY[0] == '\0') return false;

    out.uuid          = DEVICE_UUID_FIRMWARE;
    out.apiKey       = DEVICE_API_KEY;
    out.wifiSsid     = WIFI_SSID;
    out.wifiPassword = WIFI_PASSWORD;
    return true;
}

void secrets_print_diag(const Secrets& s) {
    const size_t ulen = strlen(s.uuid);
    const size_t klen = strlen(s.apiKey);
    const size_t slen = strlen(s.wifiSsid);

    Serial.print(F("[CFG ] uuid_len="));
    Serial.print(ulen);
    Serial.print(F(" key_len="));
    Serial.print(klen);
    Serial.print(F(" ssid_len="));
    Serial.print(slen);
    if (slen > 0) {
        Serial.print(F(" ssid="));
        Serial.print(s.wifiSsid);
    } else {
        Serial.print(F(" ssid=<none>"));
    }
    Serial.println();
}
