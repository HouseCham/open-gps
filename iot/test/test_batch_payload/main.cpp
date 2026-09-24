#define UNITY_INCLUDE_DOUBLE
#include <unity.h>
#include <string.h>
#include <cstdio>

#include "location_payload.h"

static char buf[8192];
constexpr uint32_t FIRST_SEQUENCE_ID = 100;
constexpr uint32_t ACK_SEQUENCE_ID = 1001;
constexpr uint32_t ROUND_TRIP_SEQUENCE_ID = 42;
constexpr uint32_t ROUND_TRIP_BOOT_ID = 7;
constexpr uint8_t ALL_FIELDS_MASK = 0x3F;
constexpr size_t ACK_BUFFER_CAPACITY = 8;
constexpr uint32_t DEDUP_SEQUENCE_ID = 7;
constexpr uint32_t DEDUP_SECOND_ID = 8;
constexpr size_t BATCH_ITEM_COUNT = 5;
constexpr size_t SMALL_BUFFER_SIZE = 64;

void setUp(void) {
    memset(buf, 0, sizeof(buf));
}

static LocationPayload sample_payload(uint32_t seq = 0) {
    LocationPayload p{};
    snprintf(p.recorded_at, sizeof(p.recorded_at), "2026-09-23T12:34:56Z");
    p.latitude        = 19.432608;
    p.longitude       = -99.133207;
    p.altitude        = 2240.5;
    p.speed_mps       = 12.5;
    p.accuracy_m      = 4.1;
    p.satellites_used = 9;
    p.battery_voltage = 3.9;
    p.signal_strength = 18;
    p.sequence_id     = seq;
    return p;
}

void test_sequence_id_included_when_positive(void) {
    LocationPayload p = sample_payload(ACK_SEQUENCE_ID);
    const size_t n = locationPayloadToJson(p, buf, sizeof(buf));
    TEST_ASSERT_GREATER_THAN(0, n);
    TEST_ASSERT_NOT_NULL(strstr(buf, "\"sequence_id\":1001"));
}

void test_sequence_id_zero_omitted(void) {
    LocationPayload p = sample_payload(0);
    const size_t n = locationPayloadToJson(p, buf, sizeof(buf));
    TEST_ASSERT_GREATER_THAN(0, n);
    TEST_ASSERT_NULL(strstr(buf, "\"sequence_id\""));
}

void test_batch_single_item(void) {
    LocationPayload items[] = {sample_payload(1)};
    const size_t n = locationBatchToJson(items, 1, buf, sizeof(buf));
    TEST_ASSERT_GREATER_THAN(0, n);
    TEST_ASSERT_NOT_NULL(strstr(buf, "{\"items\":["));
    TEST_ASSERT_NOT_NULL(strstr(buf, "\"sequence_id\":1"));
    TEST_ASSERT_EQUAL_CHAR('}', buf[n - 1]);
}

void test_batch_many_items_and_commas(void) {
    LocationPayload items[BATCH_ITEM_COUNT];
    for (size_t i = 0; i < BATCH_ITEM_COUNT; ++i) items[i] = sample_payload(FIRST_SEQUENCE_ID + i);
    const size_t n = locationBatchToJson(items, BATCH_ITEM_COUNT, buf, sizeof(buf));
    TEST_ASSERT_GREATER_THAN(0, n);
    TEST_ASSERT_NOT_NULL(strstr(buf, "\"sequence_id\":100"));
    TEST_ASSERT_NOT_NULL(strstr(buf, "\"sequence_id\":104"));
    // No trailing comma before ]
    TEST_ASSERT_NULL(strstr(buf, ",]"));
    // Exactly 5 sequence ids
    int count = 0;
    for (const char* p = buf; (p = strstr(p, "\"sequence_id\":")); p += 14) ++count;
    TEST_ASSERT_EQUAL_INT(BATCH_ITEM_COUNT, count);
}

void test_batch_overflow_returns_zero(void) {
    LocationPayload items[3];
    for (size_t i = 0; i < 3; ++i) items[i] = sample_payload(static_cast<uint32_t>(i + 1));
    char small[SMALL_BUFFER_SIZE];
    memset(small, 0xAA, sizeof(small));
    TEST_ASSERT_EQUAL_UINT32(0, locationBatchToJson(items, 3, small, sizeof(small)));
}

void test_batch_rejects_bad_input(void) {
    LocationPayload items[] = {sample_payload(1)};
    TEST_ASSERT_EQUAL_UINT32(0, locationBatchToJson(nullptr, 1, buf, sizeof(buf)));
    TEST_ASSERT_EQUAL_UINT32(0, locationBatchToJson(items, 0, buf, sizeof(buf)));
    TEST_ASSERT_EQUAL_UINT32(0, locationBatchToJson(items, 1, buf, 8));
}

void test_parse_ack_accepted_and_rejected(void) {
    const char* json =
        "{\"accepted_sequence_ids\":[1001,1002],"
        "\"rejected\":[{\"sequence_id\":1003,\"code\":\"invalid_latitude\","
        "\"retryable\":false}]}";
    uint32_t out[ACK_BUFFER_CAPACITY] = {};
    const int n = locationBatchParseAck(json, out, ACK_BUFFER_CAPACITY);
    TEST_ASSERT_EQUAL_INT(3, n);
    TEST_ASSERT_EQUAL_UINT32(ACK_SEQUENCE_ID, out[0]);
    TEST_ASSERT_EQUAL_UINT32(ACK_SEQUENCE_ID + 1, out[1]);
    TEST_ASSERT_EQUAL_UINT32(ACK_SEQUENCE_ID + 2, out[2]);
}

void test_parse_ack_deduplicates(void) {
    const char* json =
        "{\"accepted_sequence_ids\":[7,7,8],\"rejected\":[{\"sequence_id\":7}]}";
    uint32_t out[ACK_BUFFER_CAPACITY] = {};
    const int n = locationBatchParseAck(json, out, ACK_BUFFER_CAPACITY);
    TEST_ASSERT_EQUAL_INT(2, n);
    TEST_ASSERT_EQUAL_UINT32(DEDUP_SEQUENCE_ID, out[0]);
    TEST_ASSERT_EQUAL_UINT32(DEDUP_SECOND_ID, out[1]);
}

void test_parse_ack_rejects_malformed(void) {
    uint32_t out[4] = {};
    TEST_ASSERT_EQUAL_INT(-1, locationBatchParseAck("not json", out, 4));
    TEST_ASSERT_EQUAL_INT(-1, locationBatchParseAck("{\"other\":1}", out, 4));
    TEST_ASSERT_EQUAL_INT(-1, locationBatchParseAck(nullptr, out, 4));
}

void test_fix_record_round_trip_via_payload(void) {
    const LocationPayload in = sample_payload(42);
    FixRecord record{};
    TEST_ASSERT_TRUE(locationPayloadToFixRecord(in, ROUND_TRIP_SEQUENCE_ID, ROUND_TRIP_BOOT_ID, record));
    TEST_ASSERT_EQUAL_UINT32(ROUND_TRIP_SEQUENCE_ID, record.sequence_id);
    TEST_ASSERT_EQUAL_UINT32(ROUND_TRIP_BOOT_ID, record.boot_id);
    TEST_ASSERT_EQUAL_INT32(19432608, record.latitude_e6);
    TEST_ASSERT_EQUAL_INT32(-99133207, record.longitude_e6);
    TEST_ASSERT_EQUAL_UINT8(ALL_FIELDS_MASK, record.valid_fields & ALL_FIELDS_MASK);

    LocationPayload out{};
    locationPayloadFromFixRecord(out, record);
    TEST_ASSERT_EQUAL_STRING(in.recorded_at, out.recorded_at);
    TEST_ASSERT_EQUAL_UINT32(ROUND_TRIP_SEQUENCE_ID, out.sequence_id);
    TEST_ASSERT_DOUBLE_WITHIN(1e-5, in.latitude, out.latitude);
    TEST_ASSERT_DOUBLE_WITHIN(1e-5, in.longitude, out.longitude);
    TEST_ASSERT_DOUBLE_WITHIN(1e-2, in.altitude, out.altitude);
    TEST_ASSERT_DOUBLE_WITHIN(1e-3, in.speed_mps, out.speed_mps);
    TEST_ASSERT_DOUBLE_WITHIN(1e-2, in.accuracy_m, out.accuracy_m);
    TEST_ASSERT_EQUAL_INT(in.satellites_used, out.satellites_used);
    TEST_ASSERT_DOUBLE_WITHIN(1e-3, in.battery_voltage, out.battery_voltage);
    TEST_ASSERT_EQUAL_INT(in.signal_strength, out.signal_strength);
}

void test_fix_record_unknown_optionals_stay_zero(void) {
    LocationPayload in{};
    snprintf(in.recorded_at, sizeof(in.recorded_at), "2026-09-23T12:34:56Z");
    in.latitude  = 10.0;
    in.longitude = 20.0;
    // altitude/speed/acc/sats/battery unknown; signal unknown (-1)
    in.signal_strength = -1;

    FixRecord record{};
    TEST_ASSERT_TRUE(locationPayloadToFixRecord(in, 1, 1, record));
    TEST_ASSERT_EQUAL_UINT8(0, record.valid_fields);

    LocationPayload out{};
    locationPayloadFromFixRecord(out, record);
    TEST_ASSERT_EQUAL(0.0, out.altitude);
    TEST_ASSERT_EQUAL(0.0, out.speed_mps);
    TEST_ASSERT_EQUAL(0.0, out.accuracy_m);
    TEST_ASSERT_EQUAL_INT(0, out.satellites_used);
    TEST_ASSERT_EQUAL(0.0, out.battery_voltage);
    TEST_ASSERT_EQUAL_INT(-1, out.signal_strength);
}

void test_fix_record_rejects_bad_coordinates(void) {
    LocationPayload in = sample_payload();
    in.latitude = 91.0;
    FixRecord record{};
    TEST_ASSERT_FALSE(locationPayloadToFixRecord(in, 1, 1, record));
}

int main(int argc, char** argv) {
    (void)argc; (void)argv;
    UNITY_BEGIN();
    RUN_TEST(test_sequence_id_included_when_positive);
    RUN_TEST(test_sequence_id_zero_omitted);
    RUN_TEST(test_batch_single_item);
    RUN_TEST(test_batch_many_items_and_commas);
    RUN_TEST(test_batch_overflow_returns_zero);
    RUN_TEST(test_batch_rejects_bad_input);
    RUN_TEST(test_parse_ack_accepted_and_rejected);
    RUN_TEST(test_parse_ack_deduplicates);
    RUN_TEST(test_parse_ack_rejects_malformed);
    RUN_TEST(test_fix_record_round_trip_via_payload);
    RUN_TEST(test_fix_record_unknown_optionals_stay_zero);
    RUN_TEST(test_fix_record_rejects_bad_coordinates);
    return UNITY_END();
}
