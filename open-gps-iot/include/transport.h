#pragma once

#include <stddef.h>
#include <stdint.h>

#include "transport_url.h"  // lib/transport/ — pure URL constructor (no Arduino deps)

// Forward declare to avoid pulling <Arduino.h> (via secrets.h) into
// modules that just want URL construction. The full definition lives
// in secrets.h and is included by ESP32-side callers (src/main.cpp,
// src/transport.cpp) where Arduino.h is available.
struct Secrets;
struct LocationPayload;

enum class TransportResult : uint8_t {
    SENT,
    WIFI_DISCONNECTED,
    TRANSPORT_ERROR,
    HTTP_ERROR,
    CONFIG_ERROR
};

// Stage 3 transport: WiFi + HTTPS POST.
//
// transport_begin() initialises the ESP32's WiFi stack and blocks until
// either a connection is up or the timeout elapses. WiFi is optional —
// if secrets.wifi_ssid is empty, transport_begin() returns false without
// trying to connect, so devices that only want GPS polling still boot.
//
// transport_post_locations() serialises the payload, builds the URL,
// attaches the X-Device-API-Key header, and POSTs the body. Retries once
// after 2 s on connection failure; returns true on HTTP 201 (the only
// success status the backend emits).

// How long transport_begin() waits for WiFi association before giving up.
constexpr uint32_t WIFI_CONNECT_TIMEOUT_MS = 15000;

// How long transport_post_locations() waits between the first and second
// attempt on connection failure.
constexpr uint32_t UPLOAD_RETRY_DELAY_MS = 2000;

// Pure URL constructor (no network). Builds the POST target as
// "<API_HOST>:<API_PORT>/api/v1/devices/<uuid>/locations". Returns the
// number of bytes written (excluding NUL), or 0 on overflow or any NULL
// input. Defined in transport.cpp and unit-tested in test_url_build.cpp.
size_t transport_build_url(const char* api_host,
                           uint16_t    api_port,
                           const char* uuid,
                           char*       buf,
                           size_t      buf_len);

// Brings up WiFi using the credentials in `s.wifi_ssid` / `s.wifi_password`.
// Returns true if WiFi is connected (IP assigned); false if no SSID is
// configured or the timeout elapses without associating. On success, WiFi
// stays connected for the lifetime of the firmware.
bool transport_begin(const Secrets& s);

// POSTs the payload to the backend. Distinguishes an accepted request,
// transport failure, HTTP rejection, and invalid local request data.
TransportResult transport_post_locations(const LocationPayload& p, const Secrets& s);
