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
    out.api_key       = DEVICE_API_KEY;
    out.wifi_ssid     = WIFI_SSID;
    out.wifi_password = WIFI_PASSWORD;
    return true;
}

void secrets_print_diag(const Secrets& s) {
    const size_t ulen = strlen(s.uuid);
    const size_t klen = strlen(s.api_key);
    const size_t slen = strlen(s.wifi_ssid);

    Serial.print(F("[CFG ] uuid_len="));
    Serial.print(ulen);
    Serial.print(F(" key_len="));
    Serial.print(klen);
    Serial.print(F(" uuid="));
    Serial.print(s.uuid);
    Serial.print(F(" key_mask="));
    Serial.print(s.api_key[0]);
    Serial.print(s.api_key[1]);
    Serial.print(s.api_key[2]);
    Serial.print(s.api_key[3]);
    Serial.print(F("..."));
    Serial.print(s.api_key[klen - 4]);
    Serial.print(s.api_key[klen - 3]);
    Serial.print(s.api_key[klen - 2]);
    Serial.print(s.api_key[klen - 1]);
    Serial.print(F(" ssid_len="));
    Serial.print(slen);
    if (slen > 0) {
        Serial.print(F(" ssid="));
        Serial.print(s.wifi_ssid);
    } else {
        Serial.print(F(" ssid=<none>"));
    }
    Serial.println();
}