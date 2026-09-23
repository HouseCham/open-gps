#pragma once

#include <stddef.h>
#include <stdint.h>

#include "transport_url.h"  // lib/transport/ — pure URL constructor (no Arduino deps)
#include "fix_record.h"     // lib/fix_queue/ — pure FixRecord (no Arduino deps)

// Forward declare to avoid pulling <Arduino.h> (via secrets.h) into
// modules that just want URL construction. The full definition lives
// in secrets.h and is included by ESP32-side callers (src/main.cpp,
// src/transport.cpp) where Arduino.h is available.
struct Secrets;
struct LocationPayload;

enum class TransportResult : uint8_t {
    SENT,
    TRANSPORT_ERROR,
    TIMEOUT,
    HTTP_CLIENT_ERROR,
    HTTP_SERVER_ERROR,
    CONFIG_ERROR
};

// Cellular HTTPS transport (TinyGSM / SIM7080G).
//
// transport_cellular_begin() brings up LTE-M + PDP once during setup().
//
// transport_post_locations() serialises a single payload to POST
// .../locations and returns on the first terminal result.
//
// transport_post_batch() POSTs up to BATCH_MAX_ITEMS queued FixRecords to
// .../locations/batch. A 201 means every item was accepted or permanently
// rejected — the caller must ack_front(count) only on SENT.

// How long transport_post_locations() waits between the first and second
// attempt on connection failure.
constexpr uint32_t UPLOAD_RETRY_DELAY_MS = 2000;

// Pure URL constructor (no network). Builds the POST target as
// "<API_HOST>:<API_PORT>/api/v1/devices/<uuid>/locations". Returns the
// number of bytes written (excluding NUL), or 0 on overflow or any NULL
// input. Defined in lib/transport/transport_url.cpp and unit-tested.
size_t transport_build_url(const char* api_host,
                           uint16_t    api_port,
                           const char* uuid,
                           char*       buf,
                           size_t      buf_len);

// Same as transport_build_url but targets .../locations/batch.
size_t transport_build_batch_url(const char* api_host,
                                 uint16_t    api_port,
                                 const char* uuid,
                                 char*       buf,
                                 size_t      buf_len);

// Brings up the modem data path (CFUN, APN, registration, PDP).
// Returns true if the network is registered and GPRS is connected.
bool transport_cellular_begin();

// POSTs the payload to the backend. Distinguishes an accepted request,
// transport failure, HTTP rejection, and invalid local request data.
TransportResult transport_post_locations(const LocationPayload& p, const Secrets& s);

// POSTs a batch of queued records. Reads the full HTTP response body and
// logs accepted/rejected sequence ids; returns SENT only on HTTP 201.
// Retries once after UPLOAD_RETRY_DELAY_MS on transport failure, same as
// the single-post path.
TransportResult transport_post_batch(const FixRecord* records, size_t count,
                                     const Secrets& s);
