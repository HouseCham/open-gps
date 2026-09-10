#include "location_payload.h"

#include <stdio.h>
#include <ArduinoJson.h>

void location_payload_from_fix(LocationPayload& p,
                               float lat, float lon,
                               float speed_kmh, float alt,
                               int   sats_used,
                               float accuracy_m,
                               int yy, int mo, int dd,
                               int hh, int mi, int ss) {
    p.latitude        = lat;
    p.longitude       = lon;
    p.altitude        = alt;
    p.speed_mps       = speed_kmh / 3.6;  // km/h -> m/s for the API
    p.accuracy_m      = accuracy_m;
    p.satellites_used = sats_used;
    snprintf(p.recorded_at, sizeof(p.recorded_at),
             "%04d-%02d-%02dT%02d:%02d:%02dZ",
             yy, mo, dd, hh, mi, ss);
}

size_t location_payload_to_json(const LocationPayload& p,
                                char* buf, size_t buf_len) {
    StaticJsonDocument<256> doc;
    JsonObject obj = doc.to<JsonObject>();

    obj["recorded_at"] = p.recorded_at;

    // lat/lon out of WGS84 range are omitted (don't send bad data).
    if (p.latitude  >= -90.0  && p.latitude  <= 90.0)  obj["latitude"]  = p.latitude;
    if (p.longitude >= -180.0 && p.longitude <= 180.0) obj["longitude"] = p.longitude;

    // Treat 0 as "unknown" for optional fields: drop them from the JSON
    // rather than emit a misleading 0.0. The API contract treats these
    // as null-when-unknown, and the DB layer does the same.
    if (p.altitude       != 0.0) obj["altitude"]        = p.altitude;
    if (p.speed_mps      >  0.0) obj["speed"]           = p.speed_mps;
    if (p.accuracy_m     >  0.0) obj["accuracy"]        = p.accuracy_m;
    if (p.satellites_used >  0)  obj["satellites_used"] = p.satellites_used;

    return serializeJson(obj, buf, buf_len);
}