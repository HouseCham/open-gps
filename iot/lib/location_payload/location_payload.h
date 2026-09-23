#pragma once

#include <stddef.h>
#include <stdint.h>

#include "fix_record.h"

// One GPS fix shaped to match the backend's POST /locations contract.
// Fields map directly to the JSON body keys; missing/zero optionals are
// omitted from the serialized output (see toJson()).
struct LocationPayload {
    // GPS fix timestamp from the device clock, ISO 8601 / RFC 3339 form.
    // e.g. "2026-07-15T12:00:00Z". Always written by fromFix().
    char recorded_at[FIX_TIMESTAMP_LENGTH];

    // Doubles, not floats: ArduinoJson v7 hardcodes 6 decimal places for
    // float and 9 for double. With double, 19.432608 serialises as
    // 19.432608 (not the rounded 19.43261 a float would produce), which
    // matches the API example and keeps ~1 mm of GPS precision.
    double latitude;   // WGS84 decimal degrees, -90..90
    double longitude;  // WGS84 decimal degrees, -180..180
    double altitude;   // metres above sea level; 0 = unknown (omitted)
    double speed_mps;  // ground speed in m/s; 0 = unknown (omitted)
    double accuracy_m; // position accuracy in metres; 0 = unknown (omitted)
    uint16_t satellites_used; // sats used in the fix; 0 = unknown (omitted)

    // Battery voltage in volts (AXP2101 reading, mV/1000), 0..6 per the API
    // contract. 0 = unknown (omitted). This is VOLTAGE, not a battery
    // percentage — do not interpret it as state of charge.
    double battery_voltage;

    // Cellular signal strength on the SIM7080G AT+CSQ scale, 0..31
    // (0 = weak, 31 = strong). -1 = unknown (omitted); the modem's
    // "99 = unknown" is mapped to -1 by the caller and never serialized.
    int8_t signal_strength;

    // Batch idempotency key required by POST .../locations/batch.
    // 0 = unknown / not queued (omitted from JSON, valid on the
    // individual endpoint where the field is optional).
    uint32_t sequence_id;
};

// valid_fields bitmask stored in FixRecord.
constexpr uint8_t FIX_FIELD_ALTITUDE   = 1u << 0;
constexpr uint8_t FIX_FIELD_SPEED      = 1u << 1;
constexpr uint8_t FIX_FIELD_ACCURACY   = 1u << 2;
constexpr uint8_t FIX_FIELD_SATELLITES = 1u << 3;
constexpr uint8_t FIX_FIELD_BATTERY    = 1u << 4;
constexpr uint8_t FIX_FIELD_SIGNAL     = 1u << 5;

// Serialize this payload to a JSON object string into `buf`.
// Returns the number of bytes written (excluding NUL), or 0 on overflow.
// Optional fields are omitted when their value is 0 (treated as "unknown");
// lat/lon are always written if they are within the valid WGS84 range,
// otherwise omitted. sequence_id is written only when > 0.
size_t location_payload_to_json(const LocationPayload& p,
                                char* buf, size_t buf_len);

// Serialize a batch body `{"items":[...]}` for POST .../locations/batch.
// Returns bytes written (excluding NUL), or 0 on overflow / bad input.
// Items keep their sequence_id; callers must set it before calling.
size_t location_batch_to_json(const LocationPayload* items, size_t count,
                              char* buf, size_t buf_len);

// Parse `accepted_sequence_ids` and `rejected[].sequence_id` from a batch
// ACK body into `out` (deduplicated, order preserved). Returns the number
// of sequence ids written, or -1 if `json` is not valid JSON / missing
// both fields. Used for diagnostics; a 201 alone is enough to ack.
int location_batch_parse_ack(const char* json, uint32_t* out, size_t max_out);

// Build a payload directly from the values modem.getGPS() writes through
// its out-params. speed_kmh is the TinyGPS ground speed in km/h and is
// converted to m/s internally (the API contract expects m/s).
// accuracy_m is the HDOP-derived position accuracy in metres.
void location_payload_from_fix(LocationPayload& p,
                               float lat, float lon,
                               float speed_kmh, float alt,
                               uint16_t sats_used,
                               float accuracy_m,
                               int16_t yy, int16_t mo, int16_t dd,
                               int16_t hh, int16_t mi, int16_t ss);

// Widen a queued FixRecord back into a payload for JSON serialisation.
void location_payload_from_fix_record(LocationPayload& out,
                                      const FixRecord& record);

// Scale a payload into a FixRecord for the persistent queue. Assigns
// sequence_id/boot_id and fills valid_fields from known (non-unknown)
// optionals. Returns false if recorded_at is not NUL-terminated.
bool location_payload_to_fix_record(const LocationPayload& in,
                                    uint32_t sequence_id,
                                    uint32_t boot_id,
                                    FixRecord& out);
