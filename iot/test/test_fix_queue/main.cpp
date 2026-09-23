#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include <unity.h>

#include "fix_record.h"

constexpr size_t CORRUPT_OFFSET = 20;
constexpr uint8_t BAD_VERSION = 99;

static FixRecord sample() {
    FixRecord record{};
    record.sequence_id = 0x12345678;
    record.boot_id = 42;
    snprintf(record.recorded_at, sizeof(record.recorded_at), "%s", "2026-09-23T12:34:56Z");
    record.latitude_e6 = 19432608;
    record.longitude_e6 = -99133207;
    record.altitude_cm = 224050;
    record.speed_mmps = 12500;
    record.accuracy_cm = 410;
    record.satellites_used = 9;
    record.battery_mv = 3910;
    record.signal_strength = 18;
    record.valid_fields = 0x7F;
    return record;
}

void test_round_trip() {
    const FixRecord expected = sample();
    FixRecord actual{};
    uint8_t wire[FIX_RECORD_WIRE_SIZE]{};
    TEST_ASSERT_TRUE(fix_record_encode(expected, wire, sizeof(wire)));
    TEST_ASSERT_TRUE(fix_record_decode(wire, sizeof(wire), actual));
    TEST_ASSERT_EQUAL_UINT32(expected.sequence_id, actual.sequence_id);
    TEST_ASSERT_EQUAL_INT32(expected.latitude_e6, actual.latitude_e6);
    TEST_ASSERT_EQUAL_INT32(expected.longitude_e6, actual.longitude_e6);
    TEST_ASSERT_EQUAL_STRING(expected.recorded_at, actual.recorded_at);
    TEST_ASSERT_EQUAL_UINT8(expected.valid_fields, actual.valid_fields);
}

void test_crc_rejects_corruption() {
    uint8_t wire[FIX_RECORD_WIRE_SIZE]{};
    FixRecord decoded{};
    TEST_ASSERT_TRUE(fix_record_encode(sample(), wire, sizeof(wire)));
    wire[CORRUPT_OFFSET] ^= 0x01;
    TEST_ASSERT_FALSE(fix_record_decode(wire, sizeof(wire), decoded));
}

void test_rejects_short_buffer_and_bad_version() {
    uint8_t wire[FIX_RECORD_WIRE_SIZE]{};
    FixRecord decoded{};
    TEST_ASSERT_FALSE(fix_record_encode(sample(), wire, FIX_RECORD_WIRE_SIZE - 1));
    TEST_ASSERT_TRUE(fix_record_encode(sample(), wire, sizeof(wire)));
    wire[0] = BAD_VERSION;
    TEST_ASSERT_FALSE(fix_record_decode(wire, sizeof(wire), decoded));
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_round_trip);
    RUN_TEST(test_crc_rejects_corruption);
    RUN_TEST(test_rejects_short_buffer_and_bad_version);
    return UNITY_END();
}
