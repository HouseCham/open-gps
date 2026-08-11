#include "transport.h"

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

#include "config.h"
#include "location_payload.h"
#include "secrets.h"  // full definitions; transport.h uses forward decls to
                       // avoid pulling <Arduino.h> into native test builds

bool transport_begin(const Secrets& s) {
    if (s.wifi_ssid == nullptr || s.wifi_ssid[0] == '\0') {
        Serial.println(F("[WIFI] no SSID configured — uploads disabled"));
        return false;
    }

    Serial.printf("[WIFI] connecting to %s ...\n", s.wifi_ssid);
    WiFi.mode(WIFI_STA);
    WiFi.begin(s.wifi_ssid, s.wifi_password);

    const unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED) {
        if (millis() - start >= WIFI_CONNECT_TIMEOUT_MS) {
            Serial.println(F("[ERR ] WiFi connect timed out"));
            WiFi.disconnect(true);
            return false;
        }
        delay(250);
    }
    Serial.printf("[OK  ] WiFi connected, IP=%s RSSI=%d dBm\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
    return true;
}

static const char* http_error_name(int code) {
    // HTTPClient error codes from <HTTPClient.h>. ESP32 Arduino renames
    // a few mbedtls errors to HTTPC_ERROR_CONNECTION_REFUSED (-1), which is
    // the code you'll see for: DNS failure, TCP refused, TLS handshake
    // failure, cert validation failure. The mbedtls underlying code is
    // not surfaced by HTTPClient — for that you have to drop down to
    // WiFiClientSecure directly.
    switch (code) {
        case HTTPC_ERROR_CONNECTION_REFUSED:  return "connection_refused (TLS/DNS/TCP)";
        case HTTPC_ERROR_SEND_HEADER_FAILED:  return "send_header_failed";
        case HTTPC_ERROR_SEND_PAYLOAD_FAILED: return "send_payload_failed";
        case HTTPC_ERROR_NOT_CONNECTED:       return "not_connected";
        case HTTPC_ERROR_CONNECTION_LOST:     return "connection_lost";
        case HTTPC_ERROR_READ_TIMEOUT:        return "read_timeout";
        default:                              return "unknown";
    }
}

static TransportResult post_once(const char* url, const char* api_key,
                                 const char* json_body) {
    Serial.printf("[POST] %u-byte body, "
                  "time=%lu free_heap=%u\n",
                  (unsigned)strlen(json_body),
                  (unsigned long)time(nullptr),
                  (unsigned)ESP.getFreeHeap());

    WiFiClientSecure client;
    // STAGE 3 DEV ONLY — bypass cert validation. CloudFlare's cert is
    // rejected because the ESP32's clock is unset (time=0 at boot);
    // mbedtls checks cert notBefore against time(NULL) and bails with -1.
    // For dev/bench, setInsecure() is the fastest path to a working
    // pipeline. For Stage 4 (sleep + cycle): add configTime() with NTP
    // after WiFi.begin() succeeds, wait for time(nullptr) > 2025-01-01,
    // then switch back to setCACert(cloudflare_root_ca). Otherwise any
    // attacker on the LAN can MITM the connection (and steal the
    // X-Device-API-Key).
    client.setInsecure();

    HTTPClient http;
    http.begin(client, url);

    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-API-Key", api_key);
    http.setTimeout(5000);

    const int code = http.POST((uint8_t*)json_body, strlen(json_body));

    if (code == 201) {
        Serial.printf("[POST] 201 OK (%u bytes)\n",
                      (unsigned)http.getSize());
        http.end();
        return TransportResult::SENT;
    } else if (code > 0) {
        // HTTP responded but with an error status. Read the body for context.
        String body = http.getString();
        Serial.printf("[ERR ] HTTP %d: %s\n", code, body.c_str());
        http.end();
        return TransportResult::HTTP_ERROR;
    } else {
        // code < 0: transport-level failure (DNS, TLS, connection refused).
        // The underlying mbedtls error code is NOT exposed by HTTPClient.
        // We can only narrow it down by looking at the diagnostic context
        // we logged above + the WiFiClientSecure.cpp line that fired.
        Serial.printf("[ERR ] HTTP transport failure (code=%d %s)\n",
                      code, http_error_name(code));

        // Hint at the two most common causes so the log is actionable.
        if (time(nullptr) < 1700000000UL) {
            // < 2023-11-14 means the system clock is unset or wildly wrong.
            // With setInsecure() this is harmless for now, but it WILL block
            // cert-validated HTTPS in production.
            Serial.println(F("[HINT] system clock looks unset (time<2023-11). "
                             "OK while using setInsecure(); will block TLS cert "
                             "validation in production — schedule configTime()+NTP "
                             "for Stage 4"));
        }
        if (code == HTTPC_ERROR_CONNECTION_REFUSED) {
            Serial.println(F("[HINT] TLS handshake failed (mbedtls returned -1). "
                             "If setInsecure() is already on, this is a DNS, TCP, "
                             "or cipher mismatch — not a cert issue"));
        }

        http.end();
        return TransportResult::TRANSPORT_ERROR;
    }
}

TransportResult transport_post_locations(const LocationPayload& p, const Secrets& s) {
    const wl_status_t ws = WiFi.status();
    if (ws != WL_CONNECTED) {
        Serial.printf("[ERR ] WiFi not connected (status=%d); skipping upload\n", (int)ws);
        return TransportResult::WIFI_DISCONNECTED;
    }
    Serial.printf("[NET ] wifi rssi=%d dBm chan=%d\n",
                  (int)WiFi.RSSI(), (int)WiFi.channel());

    char url[256];
    if (transport_build_url(API_HOST, 0, s.uuid,
                            url, sizeof(url)) == 0) {
        Serial.println(F("[ERR ] URL overflow"));
        return TransportResult::CONFIG_ERROR;
    }

    char body[256];
    const size_t bn = location_payload_to_json(p, body, sizeof(body));
    if (bn == 0) {
        Serial.println(F("[ERR ] JSON overflow"));
        return TransportResult::CONFIG_ERROR;
    }

    Serial.printf("[POST] -> %s\n", url);
    TransportResult result = post_once(url, s.api_key, body);
    if (result != TransportResult::TRANSPORT_ERROR) return result;

    Serial.printf("[RETRY] backing off %u ms\n",
                  (unsigned)UPLOAD_RETRY_DELAY_MS);
    delay(UPLOAD_RETRY_DELAY_MS);
    return post_once(url, s.api_key, body);
}
