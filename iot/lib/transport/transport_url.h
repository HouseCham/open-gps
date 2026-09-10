#pragma once

#include <stddef.h>
#include <stdint.h>

// Pure URL constructor for the POST /locations endpoint. No network, no
// Arduino dependencies — lives in lib/transport/ so it compiles on both
// the ESP32 and the native test env without dragging in WiFi.h.
//
// Returns the number of bytes written to buf (excluding NUL), or 0 on
// overflow or any NULL input.
//
// If api_port is non-zero, the result is:
//   <api_host>:<api_port>/api/v1/devices/<uuid>/locations
// If api_port is 0, the result is:
//   <api_host>/api/v1/devices/<uuid>/locations
//
// api_host is conventionally "https://..." (scheme included); any trailing
// slash on api_host is safe but not recommended.
size_t transport_build_url(const char* api_host,
                           uint16_t    api_port,
                           const char* uuid,
                           char*       buf,
                           size_t      buf_len);