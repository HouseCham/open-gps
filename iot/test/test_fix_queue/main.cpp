#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include <unity.h>

#include "fix_queue.h"
#include "fix_record.h"

constexpr size_t CORRUPT_OFFSET = 20;
constexpr uint8_t BAD_VERSION = 99;
constexpr uint32_t RING_CAPACITY = 8;
constexpr uint32_t SAMPLE_BOOT_ID = 42;
constexpr int32_t SAMPLE_LATITUDE_E6 = 19432608;
constexpr int32_t SAMPLE_LONGITUDE_E6 = -99133207;
constexpr uint8_t SAMPLE_VALID_FIELDS = 0x7F;
constexpr uint32_t META_GENERATION = 7;
constexpr uint32_t META_HEAD = 3;
constexpr uint32_t META_TAIL = 1;
constexpr uint32_t META_COUNT = 2;
constexpr uint32_t META_NEXT_SEQUENCE = 100;
constexpr uint32_t META_LOST_COUNT = 5;
constexpr uint32_t HIGHER_GENERATION = 5;
constexpr uint32_t LOWER_GENERATION = 4;
constexpr uint32_t INVALID_SLOT_NEXT_SEQUENCE = 9;
constexpr int32_t SAMPLE_ALTITUDE_CM = 224050;
constexpr int32_t SAMPLE_SPEED_MMPS = 12500;
constexpr int32_t SAMPLE_ACCURACY_CM = 410;
constexpr uint16_t SAMPLE_SATELLITES = 9;
constexpr uint16_t SAMPLE_BATTERY_MV = 3910;
constexpr int8_t SAMPLE_SIGNAL = 18;
constexpr uint32_t ADVANCE_INDEX = 5;

static FixRecord sample(uint32_t seq = 0x12345678) {
    FixRecord record{};
    record.sequence_id = seq;
    record.boot_id = SAMPLE_BOOT_ID;
    snprintf(record.recorded_at, sizeof(record.recorded_at), "%s", "2026-09-23T12:34:56Z");
    record.latitude_e6 = SAMPLE_LATITUDE_E6;
    record.longitude_e6 = SAMPLE_LONGITUDE_E6;
    record.altitude_cm = SAMPLE_ALTITUDE_CM;
    record.speed_mmps = SAMPLE_SPEED_MMPS;
    record.accuracy_cm = SAMPLE_ACCURACY_CM;
    record.satellites_used = SAMPLE_SATELLITES;
    record.battery_mv = SAMPLE_BATTERY_MV;
    record.signal_strength = SAMPLE_SIGNAL;
    record.valid_fields = SAMPLE_VALID_FIELDS;
    return record;
}

void test_round_trip() {
    const FixRecord expected = sample();
    FixRecord actual{};
    uint8_t wire[FIX_RECORD_WIRE_SIZE]{};
    TEST_ASSERT_TRUE(fixRecordEncode(expected, wire, sizeof(wire)));
    TEST_ASSERT_TRUE(fixRecordDecode(wire, sizeof(wire), actual));
    TEST_ASSERT_EQUAL_UINT32(expected.sequence_id, actual.sequence_id);
    TEST_ASSERT_EQUAL_INT32(expected.latitude_e6, actual.latitude_e6);
    TEST_ASSERT_EQUAL_INT32(expected.longitude_e6, actual.longitude_e6);
    TEST_ASSERT_EQUAL_STRING(expected.recorded_at, actual.recorded_at);
    TEST_ASSERT_EQUAL_UINT8(expected.valid_fields, actual.valid_fields);
}

void test_crc_rejects_corruption() {
    uint8_t wire[FIX_RECORD_WIRE_SIZE]{};
    FixRecord decoded{};
    TEST_ASSERT_TRUE(fixRecordEncode(sample(), wire, sizeof(wire)));
    wire[CORRUPT_OFFSET] ^= 0x01;
    TEST_ASSERT_FALSE(fixRecordDecode(wire, sizeof(wire), decoded));
}

void test_rejects_short_buffer_and_bad_version() {
    uint8_t wire[FIX_RECORD_WIRE_SIZE]{};
    FixRecord decoded{};
    TEST_ASSERT_FALSE(fixRecordEncode(sample(), wire, FIX_RECORD_WIRE_SIZE - 1));
    TEST_ASSERT_TRUE(fixRecordEncode(sample(), wire, sizeof(wire)));
    wire[0] = BAD_VERSION;
    TEST_ASSERT_FALSE(fixRecordDecode(wire, sizeof(wire), decoded));
}

void test_meta_round_trip() {
    FixQueueMeta expected = fixQueueMetaFresh(RING_CAPACITY);
    expected.generation = META_GENERATION;
    expected.head = META_HEAD;
    expected.tail = META_TAIL;
    expected.count = META_COUNT;
    expected.next_seq = META_NEXT_SEQUENCE;
    expected.lost_count = META_LOST_COUNT;

    uint8_t wire[FIX_QUEUE_META_WIRE_SIZE]{};
    FixQueueMeta actual{};
    TEST_ASSERT_TRUE(fixQueueMetaEncode(expected, wire, sizeof(wire)));
    TEST_ASSERT_TRUE(fixQueueMetaDecode(wire, sizeof(wire), actual));
    TEST_ASSERT_EQUAL_UINT32(expected.generation, actual.generation);
    TEST_ASSERT_EQUAL_UINT32(expected.capacity, actual.capacity);
    TEST_ASSERT_EQUAL_UINT32(expected.head, actual.head);
    TEST_ASSERT_EQUAL_UINT32(expected.tail, actual.tail);
    TEST_ASSERT_EQUAL_UINT32(expected.count, actual.count);
    TEST_ASSERT_EQUAL_UINT32(expected.next_seq, actual.next_seq);
    TEST_ASSERT_EQUAL_UINT32(expected.lost_count, actual.lost_count);
}

void test_meta_crc_rejects_corruption() {
    FixQueueMeta meta = fixQueueMetaFresh(RING_CAPACITY);
    uint8_t wire[FIX_QUEUE_META_WIRE_SIZE]{};
    FixQueueMeta out{};
    TEST_ASSERT_TRUE(fixQueueMetaEncode(meta, wire, sizeof(wire)));
    wire[4] ^= 0x01;  // capacity byte
    TEST_ASSERT_FALSE(fixQueueMetaDecode(wire, sizeof(wire), out));
}

void test_meta_rejects_out_of_range_indices() {
    FixQueueMeta meta = fixQueueMetaFresh(RING_CAPACITY);
    meta.head = RING_CAPACITY;  // == capacity, invalid
    uint8_t wire[FIX_QUEUE_META_WIRE_SIZE]{};
    FixQueueMeta out{};
    TEST_ASSERT_FALSE(fixQueueMetaEncode(meta, wire, sizeof(wire)));

    meta = fixQueueMetaFresh(RING_CAPACITY);
    meta.count = RING_CAPACITY + 1;
    TEST_ASSERT_FALSE(fixQueueMetaEncode(meta, wire, sizeof(wire)));
}

void test_meta_pick_prefers_higher_generation() {
    FixQueueMeta a = fixQueueMetaFresh(RING_CAPACITY);
    a.generation = LOWER_GENERATION;
    a.head = 2;
    FixQueueMeta b = fixQueueMetaFresh(RING_CAPACITY);
    b.generation = HIGHER_GENERATION;
    b.head = 3;

    FixQueueMeta out{};
    TEST_ASSERT_TRUE(fixQueueMetaPick(&a, true, &b, true, out));
    TEST_ASSERT_EQUAL_UINT32(HIGHER_GENERATION, out.generation);
    TEST_ASSERT_EQUAL_UINT32(3, out.head);

    // Tie or lower B: A wins when B.generation <= A.generation.
    b.generation = LOWER_GENERATION;
    TEST_ASSERT_TRUE(fixQueueMetaPick(&a, true, &b, true, out));
    TEST_ASSERT_EQUAL_UINT32(LOWER_GENERATION, out.generation);
    TEST_ASSERT_EQUAL_UINT32(2, out.head);
}

void test_meta_pick_ignores_invalid_slot() {
    FixQueueMeta valid = fixQueueMetaFresh(RING_CAPACITY);
    valid.generation = 2;
    valid.next_seq = INVALID_SLOT_NEXT_SEQUENCE;

    FixQueueMeta out{};
    TEST_ASSERT_TRUE(fixQueueMetaPick(nullptr, false, &valid, true, out));
    TEST_ASSERT_EQUAL_UINT32(INVALID_SLOT_NEXT_SEQUENCE, out.next_seq);
    TEST_ASSERT_TRUE(fixQueueMetaPick(&valid, true, nullptr, false, out));
    TEST_ASSERT_EQUAL_UINT32(INVALID_SLOT_NEXT_SEQUENCE, out.next_seq);
    TEST_ASSERT_FALSE(fixQueueMetaPick(nullptr, false, nullptr, false, out));
}

void test_ring_full_and_advance() {
    FixQueueMeta meta = fixQueueMetaFresh(RING_CAPACITY);
    TEST_ASSERT_FALSE(fixQueueIsFull(meta));
    TEST_ASSERT_TRUE(fixQueueIsEmpty(meta));

    meta.count = RING_CAPACITY;
    TEST_ASSERT_TRUE(fixQueueIsFull(meta));

    TEST_ASSERT_EQUAL_UINT32(1, fixQueueAdvance(0, RING_CAPACITY));
    TEST_ASSERT_EQUAL_UINT32(0, fixQueueAdvance(RING_CAPACITY - 1, RING_CAPACITY));
    TEST_ASSERT_EQUAL_UINT32(0, fixQueueAdvance(ADVANCE_INDEX, 0));
}

void test_meta_encode_rejects_short_buffer() {
    FixQueueMeta meta = fixQueueMetaFresh(RING_CAPACITY);
    uint8_t wire[FIX_QUEUE_META_WIRE_SIZE]{};
    TEST_ASSERT_FALSE(fixQueueMetaEncode(meta, wire, FIX_QUEUE_META_WIRE_SIZE - 1));
    TEST_ASSERT_FALSE(fixQueueMetaDecode(wire, FIX_QUEUE_META_WIRE_SIZE - 1, meta));
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_round_trip);
    RUN_TEST(test_crc_rejects_corruption);
    RUN_TEST(test_rejects_short_buffer_and_bad_version);
    RUN_TEST(test_meta_round_trip);
    RUN_TEST(test_meta_crc_rejects_corruption);
    RUN_TEST(test_meta_rejects_out_of_range_indices);
    RUN_TEST(test_meta_pick_prefers_higher_generation);
    RUN_TEST(test_meta_pick_ignores_invalid_slot);
    RUN_TEST(test_ring_full_and_advance);
    RUN_TEST(test_meta_encode_rejects_short_buffer);
    return UNITY_END();
}
