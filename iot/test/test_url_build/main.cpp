#define UNITY_INCLUDE_DOUBLE
#include <unity.h>
#include <string.h>
#include <cstdio>

#include "transport.h"

static char buf[512];

void setUp(void) {
    memset(buf, 0, sizeof(buf));
}

// 1. Primary case: port=0 omits the :port suffix.
void test_url_no_port(void) {
    size_t n = transport_build_url(
        "https://gps-tracker.local",
        0,
        "c7adaf73-e5db-49ee-9437-b47bf6b4b047",
        buf, sizeof(buf));
    TEST_ASSERT_GREATER_THAN(0, n);
    TEST_ASSERT_EQUAL_STRING(
        "https://gps-tracker.local/api/v1/devices/"
        "c7adaf73-e5db-49ee-9437-b47bf6b4b047/locations",
        buf);
}

// 2. With port: appends :port as before.
void test_url_with_port(void) {
    size_t n = transport_build_url(
        "https://api.example.com",
        443,
        "aaaaaaaa-bbbb-cccc-dddd-000000000001",
        buf, sizeof(buf));
    TEST_ASSERT_GREATER_THAN(0, n);
    TEST_ASSERT_EQUAL_STRING(
        "https://api.example.com:443/api/v1/devices/"
        "aaaaaaaa-bbbb-cccc-dddd-000000000001/locations",
        buf);
}

// 3. Buffer exactly the right size: fit is reported, overflow returns 0.
void test_url_overflow_returns_zero(void) {
    // Without port: host 23 + path 41 + uuid 36 = 100 + NUL.
    // A 64-byte buffer must overflow.
    char small[64];
    size_t n = transport_build_url(
        "https://gps-tracker.local", 0,
        "c7adaf73-e5db-49ee-9437-b47bf6b4b047",
        small, sizeof(small));
    TEST_ASSERT_EQUAL_UINT(0, n);
}

// 4. Exact-fit: allocate the exact buffer size and confirm it fits.
void test_url_exact_fit(void) {
    const char* host = "https://gps-tracker.local";
    const uint16_t port = 0;
    const char* uuid = "c7adaf73-e5db-49ee-9437-b47bf6b4b047";
    size_t needed = snprintf(nullptr, 0, "%s/api/v1/devices/%s/locations",
                             host, uuid);
    char* exact = (char*)malloc(needed + 1);
    TEST_ASSERT_NOT_NULL(exact);

    size_t n = transport_build_url(host, port, uuid, exact, needed + 1);
    TEST_ASSERT_EQUAL_UINT(needed, n);
    free(exact);
}

// 5. NULL inputs are guarded (no crash, return 0).
void test_url_null_inputs(void) {
    size_t n = transport_build_url(nullptr, 0, "uuid", buf, sizeof(buf));
    TEST_ASSERT_EQUAL_UINT(0, n);

    n = transport_build_url("https://h", 0, nullptr, buf, sizeof(buf));
    TEST_ASSERT_EQUAL_UINT(0, n);

    n = transport_build_url("https://h", 0, "uuid", nullptr, sizeof(buf));
    TEST_ASSERT_EQUAL_UINT(0, n);
}

int main(int argc, char** argv) {
    (void)argc; (void)argv;
    UNITY_BEGIN();
    RUN_TEST(test_url_no_port);
    RUN_TEST(test_url_with_port);
    RUN_TEST(test_url_overflow_returns_zero);
    RUN_TEST(test_url_exact_fit);
    RUN_TEST(test_url_null_inputs);
    return UNITY_END();
}