#include "transport.h"

#include <Arduino.h>
#include <TinyGsmClient.h>
#include <esp_task_wdt.h>
#include <pgmspace.h>
#include <ArduinoJson.h>

#include "config.h"
#include "gps_board.h"
#include "location_payload.h"
#include "secrets.h"  // full definitions; transport.h uses forward decls to
                       // avoid pulling <Arduino.h> into native test builds
#include "secrets_data.h"
#include "wdt_guard.h"

namespace {
constexpr size_t URL_BUFFER_SIZE = 256;
constexpr size_t JSON_BUFFER_SIZE = 320;
constexpr size_t BATCH_JSON_BUFFER_SIZE = 2048;
constexpr size_t HOST_BUFFER_SIZE = 128;
constexpr size_t HTTP_STATUS_BUFFER_SIZE = 16;
constexpr size_t HTTP_RESPONSE_BUFFER_SIZE = 2048;
constexpr size_t BATCH_PAYLOAD_CAPACITY = 20;
constexpr uint32_t HTTP_RESPONSE_TIMEOUT_MS = 10000;
// SIM7080 +CASEND: one ~900B HTTP shot works; a 3rd CASEND on the same
// TLS conn always fails (HIL: wrote stuck at 790). Keep each POST ≤ ~900B.
constexpr size_t SUB_BATCH_ITEMS = 3;

// Reads the HTTP status line, headers (for Content-Length), and body into
// `body`. Returns the status code, or 0 on transport/parse failure.
int readHttpResponse(TinyGsmClientSecure& client, char* body, size_t bodyLen) {
    const unsigned long deadline = millis() + HTTP_RESPONSE_TIMEOUT_MS;
    auto timedOut = [&]() {
        return static_cast<long>(millis() - deadline) >= 0;
    };
    // yield() alone does not reset the ESP32 task WDT; cellular TLS can
    // stall long enough to trip it mid-POST (observed on hardware).
    auto waitByte = [&]() {
        while (!client.available() && !timedOut()) {
            esp_task_wdt_reset();
            yield();
        }
    };

    waitByte();
    if (!client.available()) return 0;

    char status[HTTP_STATUS_BUFFER_SIZE] = {};
    // Skip "HTTP/1.1 "
    if (!client.readBytesUntil(' ', status, sizeof(status) - 1)) return 0;
    memset(status, 0, sizeof(status));
    if (!client.readBytesUntil(' ', status, sizeof(status) - 1)) return 0;
    const int code = atoi(status);
    if (code <= 0) return 0;

    // Headers until blank line; capture Content-Length.
    long contentLength = -1;
    char line[128];
    for (;;) {
        waitByte();
        if (timedOut()) return 0;
        const size_t n = client.readBytesUntil('\n', line, sizeof(line) - 1);
        if (n == 0) return 0;
        line[n] = '\0';
        // Strip trailing \r
        if (n > 0 && line[n - 1] == '\r') line[n - 1] = '\0';
        if (line[0] == '\0') break;  // end of headers
        if (strncasecmp(line, "Content-Length:", 15) == 0)
            contentLength = atol(line + 15);
    }

    // Body: prefer Content-Length; otherwise read until close/timeout.
    size_t pos = 0;
    if (body != nullptr && bodyLen > 0) {
        body[0] = '\0';
        if (contentLength >= 0) {
            const size_t want = (static_cast<size_t>(contentLength) < bodyLen - 1)
                                    ? static_cast<size_t>(contentLength)
                                    : bodyLen - 1;
            while (pos < want && !timedOut()) {
                if (client.available()) {
                    const size_t got = client.readBytes(body + pos, want - pos);
                    if (got == 0) break;
                    pos += got;
                } else {
                    esp_task_wdt_reset();
                    yield();
                }
            }
        } else {
            while (pos < bodyLen - 1 && !timedOut()) {
                if (client.available()) {
                    const size_t got = client.readBytes(body + pos, bodyLen - 1 - pos);
                    if (got == 0) break;
                    pos += got;
                } else {
                    esp_task_wdt_reset();
                    yield();
                }
            }
        }
        body[pos] = '\0';
    }
    return code;
}

TransportResult postOnce(const char* url, const char* apiKey,
                         const char* jsonBody, char* response,
                         size_t responseLen) {
    Serial.printf(PSTR("[POST] %u-byte body, time=%lu free_heap=%u\n"),
                  (unsigned)strlen(jsonBody), (unsigned long)time(nullptr),
                  (unsigned)ESP.getFreeHeap());

    TinyGsmClientSecure client(board_modem());
    // TinyGSM 0.12.0 configures the SIM7080 TLS context internally; CA/SNI
    // provisioning remains a modem-firmware deployment requirement.

    const char* hostStart = strstr(url, "://");
    hostStart = hostStart ? hostStart + 3 : url;
    const char* path = strchr(hostStart, '/');
    if (!path) path = "/";
    char host[HOST_BUFFER_SIZE];
    const size_t hostLen = static_cast<size_t>(path - hostStart);
    if (hostLen == 0 || hostLen >= sizeof(host)) return TransportResult::CONFIG_ERROR;
    memcpy(host, hostStart, hostLen);
    host[hostLen] = '\0';
    // TLS handshake + write over LTE-M can exceed WATCHDOG_TIMEOUT_S with
    // no internal reset point (HIL: task_wdt abort mid-POST). Detach only
    // for those two calls; readHttpResponse re-arms its own wait-loop resets.
    bool connected = false;
    size_t sent = 0;
    // Single +CASEND for the full request: multi-CASEND dies on the 3rd
    // send regardless of delay (HIL wrote=790). Sub-batch caller keeps
    // header+body ≤ ~900B so this one shot fits the modem TX limit.
    char header[512];
    int hn = -1;
    {
        WdtDetachGuard wdtGuard;
        connected = client.connect(host, 443);
        if (connected) {
            hn = snprintf(header, sizeof(header),
                "POST %s HTTP/1.1\r\nHost: %s\r\nContent-Type: application/json\r\n"
                "X-Device-API-Key: %s\r\nContent-Length: %u\r\nConnection: close\r\n\r\n",
                path, host, apiKey, (unsigned)strlen(jsonBody));
            if (hn > 0 && (size_t)hn < sizeof(header)) {
                sent = client.write(reinterpret_cast<const uint8_t*>(header), (size_t)hn);
                if (sent == (size_t)hn) {
                    const size_t bodyLen = strlen(jsonBody);
                    const size_t w = client.write(
                        reinterpret_cast<const uint8_t*>(jsonBody), bodyLen);
                    // Two CASEND (header, body) was the known-good small-batch
                    // path; a third never lands. Success = both writes full.
                    sent = (w == bodyLen) ? 1 : 0;
                } else {
                    sent = 0;
                }
            }
        }
    }
    if (!connected) {
        Serial.println(F("[ERR ] TLS/TCP connect failed"));
        client.stop();
        return TransportResult::TRANSPORT_ERROR;
    }
    if (sent == 0) {
        Serial.printf(PSTR("[ERR ] HTTP write failed hn=%d body=%u\n"),
                      hn, (unsigned)strlen(jsonBody));
        client.stop();
        return TransportResult::TRANSPORT_ERROR;
    }

    const int code = readHttpResponse(client, response, responseLen);
    esp_task_wdt_reset();
    client.stop();
    if (code == 0) {
        Serial.println(F("[ERR ] HTTP response timeout/parse failed"));
        return TransportResult::TRANSPORT_ERROR;
    }

    if (code == 201) {
        Serial.println(F("[POST] 201 OK"));
        return TransportResult::SENT;
    }
    Serial.printf(PSTR("[ERR ] HTTP %d\n"), code);
    return code >= 500 ? TransportResult::HTTP_SERVER_ERROR
                       : TransportResult::HTTP_CLIENT_ERROR;
}

TransportResult postOnceSingle(const char* url, const char* apiKey,
                               const char* jsonBody) {
    char response[64];
    return postOnce(url, apiKey, jsonBody, response, sizeof(response));
}
}  // namespace

TransportResult transportPostLocations(const LocationPayload& p, const Secrets& s) {
    LocationPayload payload = p;
    payload.signal_strength = -1;
    const uint16_t batt_mv = board_pmu().getBattVoltage();
    const double batt_v = batt_mv / 1000.0;
    if (batt_v > 0.0 && batt_v <= 6.0) payload.battery_voltage = batt_v;
    const int csq = board_modem().getSignalQuality();
    Serial.printf(PSTR("[NET ] cellular CSQ=%d\n"), csq);
    if (csq >= 0 && csq <= 31) payload.signal_strength = csq;

    char url[URL_BUFFER_SIZE];
    if (transportBuildUrl(API_HOST, 0, s.uuid, url, sizeof(url)) == 0) {
        Serial.println(F("[ERR ] URL overflow"));
        return TransportResult::CONFIG_ERROR;
    }

    char body[JSON_BUFFER_SIZE];
    const size_t bn = locationPayloadToJson(payload, body, sizeof(body));
    if (bn == 0) {
        Serial.println(F("[ERR ] JSON overflow"));
        return TransportResult::CONFIG_ERROR;
    }

    Serial.printf(PSTR("[POST] -> %s\n"), url);
    TransportResult result = postOnceSingle(url, s.apiKey, body);
    if (result != TransportResult::TRANSPORT_ERROR) return result;

    Serial.printf(PSTR("[RETRY] backing off %u ms\n"), (unsigned)UPLOAD_RETRY_DELAY_MS);
    const unsigned long retryAt = millis() + UPLOAD_RETRY_DELAY_MS;
    while (static_cast<long>(millis() - retryAt) < 0) {
        esp_task_wdt_reset();
        yield();
    }
    {
        WdtDetachGuard wdtGuard;
        TinyGsm& modem = board_modem();
        if (!modem.isNetworkConnected() && !modem.waitForNetwork(CELLULAR_OPERATION_TIMEOUT_MS, true))
            return TransportResult::TRANSPORT_ERROR;
        if (!modem.gprsConnect(CELLULAR_APN, "", "")) return TransportResult::TRANSPORT_ERROR;
    }
    return postOnceSingle(url, s.apiKey, body);
}

TransportResult transportPostBatch(const FixRecord* records, size_t count,
                                    const Secrets& s) {
    if (records == nullptr || count == 0 || count > BATCH_PAYLOAD_CAPACITY)
        return TransportResult::CONFIG_ERROR;

    static LocationPayload payloads[BATCH_PAYLOAD_CAPACITY];
    static char body[BATCH_JSON_BUFFER_SIZE];

    // Enrich once per batch (GNSS is off during upload): battery + CSQ
    // mirror the single-post path so queued optionals that were unknown at
    // enqueue time still get a live reading.
    int live_csq = -1;
    double live_batt_v = 0.0;
    const uint16_t batt_mv = board_pmu().getBattVoltage();
    const double batt_v = batt_mv / 1000.0;
    if (batt_v > 0.0 && batt_v <= 6.0) live_batt_v = batt_v;
    const int csq = board_modem().getSignalQuality();
    Serial.printf(PSTR("[NET ] cellular CSQ=%d batch=%u\n"), csq, (unsigned)count);
    if (csq >= 0 && csq <= 31) live_csq = csq;

    for (size_t i = 0; i < count; ++i) {
        locationPayloadFromFixRecord(payloads[i], records[i]);
        if (!(records[i].valid_fields & FIX_FIELD_BATTERY) && live_batt_v > 0.0)
            payloads[i].battery_voltage = live_batt_v;
        if (!(records[i].valid_fields & FIX_FIELD_SIGNAL) && live_csq >= 0)
            payloads[i].signal_strength = live_csq;
        if (payloads[i].sequence_id == 0)
            payloads[i].sequence_id = records[i].sequence_id;
    }

    char url[URL_BUFFER_SIZE];
    if (transportBuildBatchUrl(API_HOST, 0, s.uuid, url, sizeof(url)) == 0) {
        Serial.println(F("[ERR ] batch URL overflow"));
        return TransportResult::CONFIG_ERROR;
    }

    // SIM7080 TLS: 3rd +CASEND on one connection always fails (HIL wrote=790).
    // Drain in SUB_BATCH_ITEMS chunks — each is header+body ≈ one small POST
    // that already proved 201-OK on hardware. Backend acks by sequence_id, so
    // a mid-loop failure just re-sends unacked front on the next drain.
    char response[HTTP_RESPONSE_BUFFER_SIZE];
    size_t offset = 0;
    while (offset < count) {
        const size_t chunk = min(SUB_BATCH_ITEMS, count - offset);
        const size_t bn = locationBatchToJson(payloads + offset, chunk, body, sizeof(body));
        if (bn == 0) {
            Serial.println(F("[ERR ] batch JSON overflow"));
            return TransportResult::CONFIG_ERROR;
        }

        Serial.printf(PSTR("[POST] batch %u bytes (%u/%u) -> %s\n"),
                      (unsigned)bn, (unsigned)chunk, (unsigned)count, url);
        TransportResult result = postOnce(url, s.apiKey, body, response, sizeof(response));
        if (result != TransportResult::SENT) {
            if (result != TransportResult::TRANSPORT_ERROR) return result;

            Serial.printf(PSTR("[RETRY] backing off %u ms\n"), (unsigned)UPLOAD_RETRY_DELAY_MS);
            const unsigned long retryAt = millis() + UPLOAD_RETRY_DELAY_MS;
            while (static_cast<long>(millis() - retryAt) < 0) {
                esp_task_wdt_reset();
                yield();
            }
            {
                WdtDetachGuard wdtGuard;
                TinyGsm& modem = board_modem();
                if (!modem.isNetworkConnected() && !modem.waitForNetwork(CELLULAR_OPERATION_TIMEOUT_MS, true))
                    return TransportResult::TRANSPORT_ERROR;
                if (!modem.gprsConnect(CELLULAR_APN, "", "")) return TransportResult::TRANSPORT_ERROR;
            }
            result = postOnce(url, s.apiKey, body, response, sizeof(response));
            if (result != TransportResult::SENT) return result;
        }

        uint32_t acked[BATCH_PAYLOAD_CAPACITY];
        const int n = locationBatchParseAck(response, acked, BATCH_PAYLOAD_CAPACITY);
        if (n > 0) {
            Serial.printf(PSTR("[POST] ack ids (%d):"), n);
            for (int i = 0; i < n; ++i) Serial.printf(PSTR(" %lu"), (unsigned long)acked[i]);
            Serial.println();
        }
        offset += chunk;
    }
    return TransportResult::SENT;
}

bool transportCellularBegin() {
    TinyGsm& modem = board_modem();
    Serial.println(F("[CELL] APN=hologram, RAT=LTE-M"));
    modem.sendAT("+CFUN=0");
    const bool cfunOff = modem.waitResponse(5000L) == 1;
    const bool networkModeSet = modem.setNetworkMode(2);
    const bool preferredModeSet = modem.setPreferredMode(1);
    if (!cfunOff || !networkModeSet || !preferredModeSet)
        Serial.println(F("[WARN] modem mode setup incomplete; continuing"));
    // sendAT queues the command; waitResponse immediately below validates it.
    modem.sendAT("+CGDCONT=1,\"IP\",\"", CELLULAR_APN, "\"");
    if (modem.waitResponse(5000L) != 1)
        Serial.println(F("[WARN] cellular PDP context setup failed; continuing"));
    // sendAT queues the command; waitResponse immediately below validates it.
    modem.sendAT("+CNCFG=0,1,\"", CELLULAR_APN, "\"");
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
