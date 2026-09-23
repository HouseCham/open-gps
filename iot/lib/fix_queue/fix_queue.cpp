#include "fix_record.h"

#include <string.h>

namespace {
constexpr size_t FIX_OFF_VERSION = 0;
constexpr size_t FIX_OFF_SEQUENCE_ID = 1;
constexpr size_t FIX_OFF_BOOT_ID = 5;
constexpr size_t FIX_OFF_RECORDED_AT = 9;
constexpr size_t FIX_OFF_LATITUDE_E6 = 30;
constexpr size_t FIX_OFF_LONGITUDE_E6 = 34;
constexpr size_t FIX_OFF_ALTITUDE_CM = 38;
constexpr size_t FIX_OFF_SPEED_MMPS = 42;
constexpr size_t FIX_OFF_ACCURACY_CM = 46;
constexpr size_t FIX_OFF_SATELLITES_USED = 50;
constexpr size_t FIX_OFF_BATTERY_MV = 52;
constexpr size_t FIX_OFF_SIGNAL_STRENGTH = 54;
constexpr size_t FIX_OFF_VALID_FIELDS = 55;
constexpr size_t CRC_OFFSET = FIX_RECORD_WIRE_SIZE - 2;

uint16_t crc16(const uint8_t* data, size_t length) {
    uint16_t crc = 0xFFFF;
    for (size_t i = 0; i < length; ++i) {
        crc ^= data[i];
        for (uint8_t bit = 0; bit < 8; ++bit)
            crc = (crc & 1) ? static_cast<uint16_t>((crc >> 1) ^ 0xA001) :
                              static_cast<uint16_t>(crc >> 1);
    }
    return crc;
}

void put32(uint8_t* out, uint32_t value) {
    out[0] = static_cast<uint8_t>(value);
    out[1] = static_cast<uint8_t>(value >> 8);
    out[2] = static_cast<uint8_t>(value >> 16);
    out[3] = static_cast<uint8_t>(value >> 24);
}

uint32_t get32(const uint8_t* in) {
    return static_cast<uint32_t>(in[0]) |
           (static_cast<uint32_t>(in[1]) << 8) |
           (static_cast<uint32_t>(in[2]) << 16) |
           (static_cast<uint32_t>(in[3]) << 24);
}

void put16(uint8_t* out, uint16_t value) {
    out[0] = static_cast<uint8_t>(value);
    out[1] = static_cast<uint8_t>(value >> 8);
}

uint16_t get16(const uint8_t* in) {
    return static_cast<uint16_t>(in[0] | (static_cast<uint16_t>(in[1]) << 8));
}
}

bool fix_record_encode(const FixRecord& record, uint8_t* buffer, size_t length) {
    if (buffer == nullptr || length < FIX_RECORD_WIRE_SIZE ||
        record.recorded_at[FIX_TIMESTAMP_LENGTH - 1] != '\0')
        return false;

    memset(buffer, 0, FIX_RECORD_WIRE_SIZE);
    buffer[FIX_OFF_VERSION] = FIX_RECORD_VERSION;
    put32(buffer + FIX_OFF_SEQUENCE_ID, record.sequence_id);
    put32(buffer + FIX_OFF_BOOT_ID, record.boot_id);
    memcpy(buffer + FIX_OFF_RECORDED_AT, record.recorded_at, FIX_TIMESTAMP_LENGTH);
    put32(buffer + FIX_OFF_LATITUDE_E6, static_cast<uint32_t>(record.latitude_e6));
    put32(buffer + FIX_OFF_LONGITUDE_E6, static_cast<uint32_t>(record.longitude_e6));
    put32(buffer + FIX_OFF_ALTITUDE_CM, static_cast<uint32_t>(record.altitude_cm));
    put32(buffer + FIX_OFF_SPEED_MMPS, static_cast<uint32_t>(record.speed_mmps));
    put32(buffer + FIX_OFF_ACCURACY_CM, static_cast<uint32_t>(record.accuracy_cm));
    put16(buffer + FIX_OFF_SATELLITES_USED, record.satellites_used);
    put16(buffer + FIX_OFF_BATTERY_MV, record.battery_mv);
    buffer[FIX_OFF_SIGNAL_STRENGTH] = static_cast<uint8_t>(record.signal_strength);
    buffer[FIX_OFF_VALID_FIELDS] = record.valid_fields;
    put16(buffer + CRC_OFFSET, crc16(buffer, CRC_OFFSET));
    return true;
}

bool fix_record_decode(const uint8_t* buffer, size_t length, FixRecord& record) {
    if (buffer == nullptr || length < FIX_RECORD_WIRE_SIZE ||
        buffer[FIX_OFF_VERSION] != FIX_RECORD_VERSION ||
        get16(buffer + CRC_OFFSET) != crc16(buffer, CRC_OFFSET))
        return false;

    record.sequence_id = get32(buffer + FIX_OFF_SEQUENCE_ID);
    record.boot_id = get32(buffer + FIX_OFF_BOOT_ID);
    memcpy(record.recorded_at, buffer + FIX_OFF_RECORDED_AT, FIX_TIMESTAMP_LENGTH);
    record.latitude_e6 = static_cast<int32_t>(get32(buffer + FIX_OFF_LATITUDE_E6));
    record.longitude_e6 = static_cast<int32_t>(get32(buffer + FIX_OFF_LONGITUDE_E6));
    record.altitude_cm = static_cast<int32_t>(get32(buffer + FIX_OFF_ALTITUDE_CM));
    record.speed_mmps = static_cast<int32_t>(get32(buffer + FIX_OFF_SPEED_MMPS));
    record.accuracy_cm = static_cast<int32_t>(get32(buffer + FIX_OFF_ACCURACY_CM));
    record.satellites_used = get16(buffer + FIX_OFF_SATELLITES_USED);
    record.battery_mv = get16(buffer + FIX_OFF_BATTERY_MV);
    record.signal_strength = static_cast<int8_t>(buffer[FIX_OFF_SIGNAL_STRENGTH]);
    record.valid_fields = buffer[FIX_OFF_VALID_FIELDS];
    return record.recorded_at[FIX_TIMESTAMP_LENGTH - 1] == '\0';
}
