#pragma once

#include <stddef.h>

// One GPS fix shaped to match the backend's POST /locations contract.
// Fields map directly to the JSON body keys; missing/zero optionals are
// omitted from the serialized output (see toJson()).
struct LocationPayload {
    // GPS fix timestamp from the device clock, ISO 8601 / RFC 3339 form.
    // e.g. "2026-07-15T12:00:00Z". Always written by fromFix().
    char recorded_at[21];

    // Doubles, not floats: ArduinoJson v7 hardcodes 6 decimal places for
    // float and 9 for double. With double, 19.432608 serialises as
    // 19.432608 (not the rounded 19.43261 a float would produce), which
    // matches the API example and keeps ~1 mm of GPS precision.
    double latitude;   // WGS84 decimal degrees, -90..90
    double longitude;  // WGS84 decimal degrees, -180..180
    double altitude;   // metres above sea level; 0 = unknown (omitted)
    double speed_mps;  // ground speed in m/s; 0 = unknown (omitted)
    double accuracy_m; // position accuracy in metres; 0 = unknown (omitted)
    int    satellites_used;  // sats used in the fix; 0 = unknown (omitted)
};

// Serialize this payload to a JSON object string into `buf`.
// Returns the number of bytes written (excluding NUL), or 0 on overflow.
// Optional fields are omitted when their value is 0 (treated as "unknown");
// lat/lon are always written if they are within the valid WGS84 range,
// otherwise omitted.
size_t location_payload_to_json(const LocationPayload& p,
                                char* buf, size_t buf_len);

// Build a payload directly from the values modem.getGPS() writes through
// its out-parameters. speed_kmh is the TinyGPS ground speed in km/h and is
// converted to m/s internally (the API contract expects m/s).
// accuracy_m is the HDOP-derived position accuracy in metres.
void location_payload_from_fix(LocationPayload& p,
                               float lat, float lon,
                               float speed_kmh, float alt,
                               int   sats_used,
                               float accuracy_m,
                               int yy, int mo, int dd,
                               int hh, int mi, int ss);