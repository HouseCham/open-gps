#define UNITY_INCLUDE_DOUBLE
#include <unity.h>
#include <string.h>
#include <cstdio>

#include "location_payload.h"

static char buf[512];

void setUp(void) {
    memset(buf, 0, sizeof(buf));
}

// 1. Struct fields match the values passed in.
void test_payload_from_fix(void) {
    LocationPayload p;
    location_payload_from_fix(p,
        /*lat*/       19.432608f,
        /*lon*/     -99.133207f,
        /*speed_kmh*/ 36.0f,    // 10 m/s
        /*alt*/       2240.5f,
        /*sats_used*/ 9,
        /*acc_m*/     4.1f,
        /*yy,mo,dd, hh,mi,ss*/  2026, 7, 15, 12, 0, 0);

    // The float -> double widening preserves the float's stored value.
    // 19.432608 as a float is actually 19.4326077...; widen to double and
    // we keep that exact bit pattern. The API contract cares about the
    // serialised form, not bit-exact equality with the literal.
    // TEST_ASSERT_DOUBLE_WITHIN allows for the ~1e-5 ulp that float->double
    // widening loses when the float was rounded from the double literal.
    TEST_ASSERT_DOUBLE_WITHIN(1e-4, 19.432608,  p.latitude);
    TEST_ASSERT_DOUBLE_WITHIN(1e-4, -99.133207, p.longitude);
    TEST_ASSERT_DOUBLE_WITHIN(1e-4, 10.0,       p.speed_mps);   // km/h -> m/s
    TEST_ASSERT_DOUBLE_WITHIN(1e-4, 2240.5,     p.altitude);
    TEST_ASSERT_DOUBLE_WITHIN(1e-4, 4.1,        p.accuracy_m);
    TEST_ASSERT_EQUAL_INT(9,        p.satellites_used);
    TEST_ASSERT_EQUAL_STRING("2026-07-15T12:00:00Z", p.recorded_at);
}

// 2. lat/lon + timestamp are always present.
void test_payload_lat_lon_required(void) {
    LocationPayload p = {};
    snprintf(p.recorded_at, sizeof(p.recorded_at), "2026-07-15T12:00:00Z");
    p.latitude  = 19.432608;
    p.longitude = -99.133207;

    size_t n = location_payload_to_json(p, buf, sizeof(buf));
    TEST_ASSERT_GREATER_THAN(0, n);

    TEST_ASSERT_NOT_NULL(strstr(buf, "\"recorded_at\":\"2026-07-15T12:00:00Z\""));
    TEST_ASSERT_NOT_NULL(strstr(buf, "\"latitude\":19.432608"));
    TEST_ASSERT_NOT_NULL(strstr(buf, "\"longitude\":-99.133207"));
}

// 3. recorded_at is ISO 8601 / RFC 3339.
void test_payload_timestamp_iso8601(void) {
    LocationPayload p = {};
    location_payload_from_fix(p, 0, 0, 0, 0, 0, 0,
                              2026, 1, 2, 3, 4, 5);

    TEST_ASSERT_EQUAL_STRING("2026-01-02T03:04:05Z", p.recorded_at);

    size_t n = location_payload_to_json(p, buf, sizeof(buf));
    TEST_ASSERT_GREATER_THAN(0, n);
    TEST_ASSERT_NOT_NULL(strstr(buf, "\"recorded_at\":\"2026-01-02T03:04:05Z\""));
}

// 4. Out-of-range latitude is excluded from JSON.
void test_payload_lat_range(void) {
    LocationPayload p = {};
    snprintf(p.recorded_at, sizeof(p.recorded_at), "2026-07-15T12:00:00Z");
    p.latitude  = 91.0;     // out of range
    p.longitude = 0.0;

    size_t n = location_payload_to_json(p, buf, sizeof(buf));
    TEST_ASSERT_GREATER_THAN(0, n);
    TEST_ASSERT_NULL(strstr(buf, "\"latitude\""));
    TEST_ASSERT_NOT_NULL(strstr(buf, "\"longitude\":0"));
}

// 5. Out-of-range longitude is excluded from JSON.
void test_payload_lon_range(void) {
    LocationPayload p = {};
    snprintf(p.recorded_at, sizeof(p.recorded_at), "2026-07-15T12:00:00Z");
    p.latitude  = 0.0;
    p.longitude = -181.0;   // out of range

    size_t n = location_payload_to_json(p, buf, sizeof(buf));
    TEST_ASSERT_GREATER_THAN(0, n);
    TEST_ASSERT_NOT_NULL(strstr(buf, "\"latitude\":0"));
    TEST_ASSERT_NULL(strstr(buf, "\"longitude\""));
}

// 6. Optional fields are omitted when their value is 0.
void test_payload_optionals_null_when_zero(void) {
    LocationPayload p = {};
    snprintf(p.recorded_at, sizeof(p.recorded_at), "2026-07-15T12:00:00Z");
    p.latitude        = 19.0;
    p.longitude       = -99.0;
    p.altitude        = 0.0;
    p.speed_mps       = 0.0;
    p.accuracy_m      = 0.0;
    p.satellites_used = 0;

    size_t n = location_payload_to_json(p, buf, sizeof(buf));
    TEST_ASSERT_GREATER_THAN(0, n);
    TEST_ASSERT_NULL(strstr(buf, "\"altitude\""));
    TEST_ASSERT_NULL(strstr(buf, "\"speed\""));
    TEST_ASSERT_NULL(strstr(buf, "\"accuracy\""));
    TEST_ASSERT_NULL(strstr(buf, "\"satellites_used\""));
}

// 7. TinyGPS returns speed in km/h; fromFix() converts to m/s.
void test_payload_speed_kmh_to_mps(void) {
    LocationPayload p;
    // Pass accuracy_m directly (the TinyGPS `acc` out-param is already
    // a position-error estimate in metres, derived from HDOP).
    location_payload_from_fix(p, 0, 0, 144.0f, 0, 0, 5.5f,
                              2026, 7, 15, 12, 0, 0);

    TEST_ASSERT_DOUBLE_WITHIN(1e-4, 40.0, p.speed_mps);  // 144 km/h -> 40 m/s
    TEST_ASSERT_DOUBLE_WITHIN(1e-4, 5.5,  p.accuracy_m);
}

int main(int argc, char** argv) {
    (void)argc; (void)argv;
    UNITY_BEGIN();
    RUN_TEST(test_payload_from_fix);
    RUN_TEST(test_payload_lat_lon_required);
    RUN_TEST(test_payload_timestamp_iso8601);
    RUN_TEST(test_payload_lat_range);
    RUN_TEST(test_payload_lon_range);
    RUN_TEST(test_payload_optionals_null_when_zero);
    RUN_TEST(test_payload_speed_kmh_to_mps);
    return UNITY_END();
}