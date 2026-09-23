#pragma once

#include <stddef.h>
#include <stdint.h>

constexpr uint8_t FIX_RECORD_VERSION = 1;
constexpr size_t FIX_TIMESTAMP_LENGTH = 21;
constexpr size_t FIX_RECORD_WIRE_SIZE = 64;

// Fixed-width representation of one accepted fix. Coordinates and metrics are
// scaled integers so the record is portable and does not depend on float ABI.
struct FixRecord {
    uint32_t sequence_id;
    uint32_t boot_id;
    char recorded_at[FIX_TIMESTAMP_LENGTH];
    int32_t latitude_e6;
    int32_t longitude_e6;
    int32_t altitude_cm;
    int32_t speed_mmps;
    int32_t accuracy_cm;
    uint16_t satellites_used;
    uint16_t battery_mv;
    int8_t signal_strength;
    uint8_t valid_fields;
};

// Serialize a record with version and CRC. Returns false for invalid input or
// a buffer smaller than FIX_RECORD_WIRE_SIZE.
bool fix_record_encode(const FixRecord& record, uint8_t* buffer, size_t length);

// Decode and validate version and CRC. Returns false for malformed records.
bool fix_record_decode(const uint8_t* buffer, size_t length, FixRecord& record);
