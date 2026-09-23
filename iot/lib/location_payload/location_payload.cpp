#include "location_payload.h"

#include <stdio.h>
#include <string.h>
#include <cmath>
#include <ArduinoJson.h>

void locationPayloadFromFix(LocationPayload& p,
                                float lat, float lon,
                                float speedKmh, float alt,
                                uint16_t satsUsed,
                                float accuracyM,
                                int16_t yy, int16_t mo, int16_t dd,
                                int16_t hh, int16_t mi, int16_t ss) {
    p.latitude        = lat;
    p.longitude       = lon;
    p.altitude        = alt;
    p.speed_mps       = speedKmh / 3.6;  // km/h -> m/s for the API
    p.accuracy_m      = accuracyM;
    p.satellites_used = satsUsed;
    snprintf(p.recorded_at, sizeof(p.recorded_at),
             "%04d-%02d-%02dT%02d:%02d:%02dZ",
             yy, mo, dd, hh, mi, ss);
}

size_t locationPayloadToJson(const LocationPayload& p,
                             char* buf, size_t bufLen) {
    JsonDocument doc;
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
    if (p.satellites_used > 0)   obj["satellites_used"] = p.satellites_used;

    // Battery: volts, only when finite and > 0 (0 = unknown). Not a
    // percentage. Signal: SIM7080G CSQ 0..31; -1 = unknown, and the
    // modem's "99 = unknown" must never reach the wire.
    if (std::isfinite(p.battery_voltage) && p.battery_voltage > 0.0)
        obj["battery_voltage"] = p.battery_voltage;
    if (p.signal_strength >= 0 && p.signal_strength <= 31)
        obj["signal_strength"] = p.signal_strength;

    // Batch idempotency key: required (>0) on the batch endpoint,
    // optional on the individual one. 0 means "not assigned" — omit.
    if (p.sequence_id > 0) obj["sequence_id"] = p.sequence_id;

    return serializeJson(obj, buf, bufLen);
}

size_t locationBatchToJson(const LocationPayload* items, size_t count,
                           char* buf, size_t bufLen) {
    if (items == nullptr || buf == nullptr || count == 0 || bufLen < 16)
        return 0;

    static constexpr size_t ITEM_BUFFER_SIZE = 384;
    char item[ITEM_BUFFER_SIZE];

    size_t pos = 0;
    const int prefix = snprintf(buf, bufLen, "{\"items\":[");
    if (prefix < 0 || static_cast<size_t>(prefix) >= bufLen) return 0;
    pos = static_cast<size_t>(prefix);

    for (size_t i = 0; i < count; ++i) {
        const size_t itemLen = locationPayloadToJson(items[i], item, sizeof(item));
        if (itemLen == 0) return 0;
        const size_t comma = (i == 0) ? 0 : 1;
        if (pos + comma + itemLen + 3 > bufLen) return 0;  // ",}" + NUL
        if (comma) buf[pos++] = ',';
        memcpy(buf + pos, item, itemLen);
        pos += itemLen;
    }

    if (pos + 3 > bufLen) return 0;
    buf[pos++] = ']';
    buf[pos++] = '}';
    buf[pos] = '\0';
    return pos;
}

int locationBatchParseAck(const char* json, uint32_t* out, size_t maxOut) {
    if (json == nullptr || out == nullptr || maxOut == 0) return -1;

    JsonDocument doc;
    const DeserializationError err = deserializeJson(doc, json);
    if (err) return -1;

    size_t written = 0;
    auto push = [&](uint32_t value) {
        if (value == 0 || written >= maxOut) return;
        for (size_t i = 0; i < written; ++i)
            if (out[i] == value) return;
        out[written++] = value;
    };

    bool saw_field = false;
    if (doc["accepted_sequence_ids"].is<JsonArray>()) {
        saw_field = true;
        for (JsonVariant v : doc["accepted_sequence_ids"].as<JsonArray>())
            if (v.is<uint32_t>()) push(v.as<uint32_t>());
    }
    if (doc["rejected"].is<JsonArray>()) {
        saw_field = true;
        for (JsonObject rej : doc["rejected"].as<JsonArray>()) {
            if (rej["sequence_id"].is<uint32_t>())
                push(rej["sequence_id"].as<uint32_t>());
        }
    }
    return saw_field ? static_cast<int>(written) : -1;
}

void locationPayloadFromFixRecord(LocationPayload& out,
                                  const FixRecord& record) {
    memset(&out, 0, sizeof(out));
    memcpy(out.recorded_at, record.recorded_at, sizeof(out.recorded_at));
    out.sequence_id     = record.sequence_id;
    out.latitude        = record.latitude_e6 / 1e6;
    out.longitude       = record.longitude_e6 / 1e6;
    out.altitude        = (record.valid_fields & FIX_FIELD_ALTITUDE)
                              ? record.altitude_cm / 100.0 : 0.0;
    out.speed_mps       = (record.valid_fields & FIX_FIELD_SPEED)
                              ? record.speed_mmps / 1000.0 : 0.0;
    out.accuracy_m      = (record.valid_fields & FIX_FIELD_ACCURACY)
                              ? record.accuracy_cm / 100.0 : 0.0;
    out.satellites_used = (record.valid_fields & FIX_FIELD_SATELLITES)
                              ? record.satellites_used : 0;
    out.battery_voltage = (record.valid_fields & FIX_FIELD_BATTERY)
                              ? record.battery_mv / 1000.0 : 0.0;
    out.signal_strength = (record.valid_fields & FIX_FIELD_SIGNAL)
                              ? record.signal_strength : -1;
}

bool locationPayloadToFixRecord(const LocationPayload& in,
                                uint32_t sequenceId,
                                uint32_t bootId,
                                FixRecord& out) {
    if (in.recorded_at[sizeof(in.recorded_at) - 1] != '\0' ||
        in.latitude < -90.0 || in.latitude > 90.0 ||
        in.longitude < -180.0 || in.longitude > 180.0)
        return false;

    memset(&out, 0, sizeof(out));
    out.sequence_id  = sequenceId;
    out.boot_id      = bootId;
    memcpy(out.recorded_at, in.recorded_at, sizeof(out.recorded_at));
    out.latitude_e6  = static_cast<int32_t>(std::llround(in.latitude * 1e6));
    out.longitude_e6 = static_cast<int32_t>(std::llround(in.longitude * 1e6));

    uint8_t valid = 0;
    if (in.altitude != 0.0) {
        out.altitude_cm = static_cast<int32_t>(std::llround(in.altitude * 100.0));
        valid |= FIX_FIELD_ALTITUDE;
    }
    if (in.speed_mps > 0.0) {
        out.speed_mmps = static_cast<int32_t>(std::llround(in.speed_mps * 1000.0));
        valid |= FIX_FIELD_SPEED;
    }
    if (in.accuracy_m > 0.0) {
        out.accuracy_cm = static_cast<int32_t>(std::llround(in.accuracy_m * 100.0));
        valid |= FIX_FIELD_ACCURACY;
    }
    if (in.satellites_used > 0) {
        out.satellites_used = static_cast<uint16_t>(in.satellites_used);
        valid |= FIX_FIELD_SATELLITES;
    }
    if (std::isfinite(in.battery_voltage) && in.battery_voltage > 0.0) {
        const double mv = in.battery_voltage * 1000.0;
        out.battery_mv = (mv >= 0.0 && mv <= 65535.0)
                             ? static_cast<uint16_t>(std::llround(mv)) : 0;
        if (out.battery_mv > 0) valid |= FIX_FIELD_BATTERY;
    }
    if (in.signal_strength >= 0 && in.signal_strength <= 31) {
        out.signal_strength = static_cast<int8_t>(in.signal_strength);
        valid |= FIX_FIELD_SIGNAL;
    }
    out.valid_fields = valid;
    return true;
}
