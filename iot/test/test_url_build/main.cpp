#define UNITY_INCLUDE_DOUBLE
#include <unity.h>
#include <string.h>
#include <cstdio>

#include "transport.h"

static char buf[512];
constexpr size_t SMALL_URL_BUFFER_SIZE = 64;
constexpr size_t URL_EXACT_BUFFER_SIZE = 256;
constexpr uint16_t NO_PORT = 0;
constexpr uint16_t HTTPS_PORT = 443;
constexpr char LOCAL_HOST[] = "https://gps-tracker.local";
constexpr char API_HOST[] = "https://api.example.com";
constexpr char LOCAL_UUID[] = "c7adaf73-e5db-49ee-9437-b47bf6b4b047";
constexpr char API_UUID[] = "aaaaaaaa-bbbb-cccc-dddd-000000000001";

void setUp(void) {
    memset(buf, 0, sizeof(buf));
}

// 1. Primary case: port=0 omits the :port suffix.
void test_url_no_port(void) {
    size_t n = transportBuildUrl(
        LOCAL_HOST,
        NO_PORT,
        LOCAL_UUID,
        buf, sizeof(buf));
    TEST_ASSERT_GREATER_THAN(0, n);
    TEST_ASSERT_EQUAL_STRING(
        "https://gps-tracker.local/api/v1/devices/"
        "c7adaf73-e5db-49ee-9437-b47bf6b4b047/locations",
        buf);
}

// 2. With port: appends :port as before.
void test_url_with_port(void) {
    size_t n = transportBuildUrl(
        API_HOST,
        HTTPS_PORT,
        API_UUID,
        buf, sizeof(buf));
    TEST_ASSERT_GREATER_THAN(0, n);
    TEST_ASSERT_EQUAL_STRING(
        "https://api.example.com:443/api/v1/devices/"
        "aaaaaaaa-bbbb-cccc-dddd-000000000001/locations",
        buf);
}

// 3. Buffer exactly the right size: fit is reported, overflow returns 0.
void test_url_overflow_returns_zero(void) {
    char small[SMALL_URL_BUFFER_SIZE];
    size_t n = transportBuildUrl(
        LOCAL_HOST, NO_PORT,
        LOCAL_UUID,
        small, sizeof(small));
    TEST_ASSERT_EQUAL_UINT(0, n);
}

// 4. Exact-fit: allocate the exact buffer size and confirm it fits.
void test_url_exact_fit(void) {
    const char* host = LOCAL_HOST;
    const uint16_t port = NO_PORT;
    const char* uuid = LOCAL_UUID;
    size_t needed = snprintf(nullptr, 0, "%s/api/v1/devices/%s/locations",
                             host, uuid);
    char exact[URL_EXACT_BUFFER_SIZE] = {};

    size_t n = transportBuildUrl(host, port, uuid, exact, needed + 1);
    TEST_ASSERT_EQUAL_UINT(needed, n);
}

// 5. NULL inputs are guarded (no crash, return 0).
void test_url_null_inputs(void) {
    size_t n = transportBuildUrl(nullptr, NO_PORT, "uuid", buf, sizeof(buf));
    TEST_ASSERT_EQUAL_UINT(0, n);

    n = transportBuildUrl("https://h", NO_PORT, nullptr, buf, sizeof(buf));
    TEST_ASSERT_EQUAL_UINT(0, n);

    n = transportBuildUrl("https://h", NO_PORT, "uuid", nullptr, sizeof(buf));
    TEST_ASSERT_EQUAL_UINT(0, n);
}

// 6. Batch URL appends /locations/batch.
void test_batch_url(void) {
    size_t n = transportBuildBatchUrl(
        LOCAL_HOST, NO_PORT,
        LOCAL_UUID,
        buf, sizeof(buf));
    TEST_ASSERT_GREATER_THAN(0, n);
    TEST_ASSERT_EQUAL_STRING(
        "https://gps-tracker.local/api/v1/devices/"
        "c7adaf73-e5db-49ee-9437-b47bf6b4b047/locations/batch",
        buf);
}

// 7. Batch URL overflow returns 0 (locations fits, /batch does not).
void test_batch_url_overflow(void) {
    // base URL is 87 bytes; locations needs 88 with NUL; batch needs 94.
    char small[90];
    size_t n = transportBuildBatchUrl(
        LOCAL_HOST, NO_PORT,
        LOCAL_UUID,
        small, sizeof(small));
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
    RUN_TEST(test_batch_url);
    RUN_TEST(test_batch_url_overflow);
    return UNITY_END();
}
