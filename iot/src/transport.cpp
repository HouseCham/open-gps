#include "transport.h"

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <TinyGsmClient.h>
#include <esp_task_wdt.h>
#include <pgmspace.h>

#include "config.h"
#include "gps_board.h"
#include "location_payload.h"
#include "secrets.h"  // full definitions; transport.h uses forward decls to
                       // avoid pulling <Arduino.h> into native test builds

namespace {
constexpr size_t URL_BUFFER_SIZE = 256;
constexpr size_t JSON_BUFFER_SIZE = 320;
constexpr size_t HOST_BUFFER_SIZE = 128;
constexpr size_t HTTP_STATUS_BUFFER_SIZE = 16;
constexpr uint32_t HTTP_RESPONSE_TIMEOUT_MS = 10000;
}

bool transport_begin(const Secrets& s) {
    if (s.wifi_ssid == nullptr || s.wifi_ssid[0] == '\0') {
        Serial.println(F("[WIFI] no SSID configured — uploads disabled"));
        return false;
    }

    Serial.printf(PSTR("[WIFI] connecting to %s ...\n"), s.wifi_ssid);
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
    Serial.printf(PSTR("[OK  ] WiFi connected, IP=%s RSSI=%d dBm\n"),
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
    Serial.printf(PSTR("[POST] %u-byte body, "
                  "time=%lu free_heap=%u\n"),
                  (unsigned)strlen(json_body),
                  (unsigned long)time(nullptr),
                  (unsigned)ESP.getFreeHeap());

    TinyGsmClientSecure client(board_modem());
    // TinyGSM 0.12.0 configures the SIM7080 TLS context internally; CA/SNI
    // provisioning remains a modem-firmware deployment requirement.

    const char* host_start = strstr(url, "://");
    host_start = host_start ? host_start + 3 : url;
    const char* path = strchr(host_start, '/');
    if (!path) path = "/";
    char host[HOST_BUFFER_SIZE];
    const size_t host_len = static_cast<size_t>(path - host_start);
    if (host_len == 0 || host_len >= sizeof(host)) return TransportResult::CONFIG_ERROR;
    memcpy(host, host_start, host_len);
    host[host_len] = '\0';
    if (!client.connect(host, 443)) return TransportResult::TRANSPORT_ERROR;
    if (client.printf(PSTR("POST %s HTTP/1.1\r\nHost: %s\r\nContent-Type: application/json\r\n"
                  "X-Device-API-Key: %s\r\nContent-Length: %u\r\nConnection: close\r\n\r\n%s"),
                  path, host, api_key, (unsigned)strlen(json_body), json_body) <= 0) {
        client.stop();
        return TransportResult::TRANSPORT_ERROR;
    }
    const unsigned long deadline = millis() + HTTP_RESPONSE_TIMEOUT_MS;
    while (!client.available() && static_cast<long>(millis() - deadline) < 0) yield();
    if (!client.available()) { client.stop(); return TransportResult::TRANSPORT_ERROR; }
    char status[HTTP_STATUS_BUFFER_SIZE] = {};
    client.readBytesUntil(' ', status, sizeof(status) - 1);
    client.readBytesUntil(' ', status, sizeof(status) - 1);
    const int code = atoi(status);
    client.stop();

    if (code == 201) {
        Serial.println(F("[POST] 201 OK"));
        return TransportResult::SENT;
    } else if (code > 0) {
        Serial.printf(PSTR("[ERR ] HTTP %d\n"), code);
        return code >= 500 ? TransportResult::HTTP_SERVER_ERROR : TransportResult::HTTP_CLIENT_ERROR;
    } else {
        // code < 0: transport-level failure (DNS, TLS, connection refused).
        // The underlying mbedtls error code is NOT exposed by HTTPClient.
        // We can only narrow it down by looking at the diagnostic context
        // we logged above + the WiFiClientSecure.cpp line that fired.
        Serial.printf(PSTR("[ERR ] HTTP transport failure (code=%d %s)\n"),
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

        return TransportResult::TRANSPORT_ERROR;
    }
}

TransportResult transport_post_locations(const LocationPayload& p, const Secrets& s) {
    // Enrich a local copy so the caller's payload stays untouched. Read
    // the modem CSQ once here (GNSS is off during upload; this is the only
    // extra AT exchange the telemetry adds). CSQ 99 = unknown -> -1 sentinel.
    LocationPayload payload = p;
    payload.signal_strength = -1;
    const uint16_t batt_mv = board_pmu().getBattVoltage();
    const double batt_v = batt_mv / 1000.0;
    if (batt_v > 0.0 && batt_v <= 6.0) payload.battery_voltage = batt_v; // 0..6 V API contract
    const int csq = board_modem().getSignalQuality();
    Serial.printf(PSTR("[NET ] cellular CSQ=%d\n"), csq);
    if (csq >= 0 && csq <= 31) payload.signal_strength = csq; // 99 -> stays -1 (unknown)

    char url[URL_BUFFER_SIZE];
    if (transport_build_url(API_HOST, 0, s.uuid,
                            url, sizeof(url)) == 0) {
        Serial.println(F("[ERR ] URL overflow"));
        return TransportResult::CONFIG_ERROR;
    }

    char body[JSON_BUFFER_SIZE];
    const size_t bn = location_payload_to_json(payload, body, sizeof(body));
    if (bn == 0) {
        Serial.println(F("[ERR ] JSON overflow"));
        return TransportResult::CONFIG_ERROR;
    }

    Serial.printf(PSTR("[POST] -> %s\n"), url);
    TransportResult result = post_once(url, s.api_key, body);
    if (result != TransportResult::TRANSPORT_ERROR) return result;

    Serial.printf(PSTR("[RETRY] backing off %u ms\n"),
                  (unsigned)UPLOAD_RETRY_DELAY_MS);
    const unsigned long retryAt = millis() + UPLOAD_RETRY_DELAY_MS;
    while (static_cast<long>(millis() - retryAt) < 0) {
        esp_task_wdt_reset();
        yield();
    }
    TinyGsm& modem = board_modem();
    if (!modem.isNetworkConnected() && !modem.waitForNetwork(CELLULAR_OPERATION_TIMEOUT_MS, true))
        return TransportResult::TRANSPORT_ERROR;
    if (!modem.gprsConnect(CELLULAR_APN, "", "")) return TransportResult::TRANSPORT_ERROR;
    return post_once(url, s.api_key, body);
}
bool transport_cellular_begin() {
    TinyGsm& modem = board_modem();
    Serial.println(F("[CELL] APN=hologram, RAT=LTE-M"));
    modem.sendAT("+CFUN=0");
    const bool cfunOff = modem.waitResponse(5000L) == 1;
    const bool networkModeSet = modem.setNetworkMode(2);
    const bool preferredModeSet = modem.setPreferredMode(1);
    if (!cfunOff || !networkModeSet || !preferredModeSet)
        Serial.println(F("[WARN] modem mode setup incomplete; continuing"));
    modem.sendAT("+CGDCONT=1,\"IP\",\"hologram\"");
    if (modem.waitResponse(5000L) != 1)
        Serial.println(F("[WARN] cellular PDP context setup failed; continuing"));
    modem.sendAT("+CNCFG=0,1,\"hologram\"");
    if (modem.waitResponse(5000L) != 1)
        Serial.println(F("[WARN] cellular network profile setup failed; continuing"));
    modem.sendAT("+CFUN=1");
    if (modem.waitResponse(10000L) != 1)
        Serial.println(F("[WARN] modem power-up response missing; continuing"));
    Serial.println(F("[CELL] waiting for network registration"));
    const unsigned long registration_deadline = millis() + 600000UL;
    bool registered = false;
    while ((long)(millis() - registration_deadline) < 0) {
        if (modem.waitForNetwork(10000L, true)) {
            registered = true;
            break;
        }
        Serial.printf(PSTR("[CELL] still searching, CSQ=%d\n"), modem.getSignalQuality());
        esp_task_wdt_reset();
    }
    if (!registered) {
        Serial.println(F("[ERR ] cellular registration failed after 10 min"));
        return false;
    }
    Serial.printf(PSTR("[CELL] registered, CSQ=%d\n"), modem.getSignalQuality());
    if (!modem.gprsConnect(CELLULAR_APN, "", "")) {
        Serial.println(F("[ERR ] cellular PDP/APN activation failed"));
        return false;
    }
    Serial.printf(PSTR("[OK  ] cellular data IP=%s\n"), modem.localIP().toString().c_str());
    return true;
}
