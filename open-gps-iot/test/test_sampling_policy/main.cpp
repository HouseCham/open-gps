#include <cmath>
#include <unity.h>
#include "sampling_policy.h"

static SamplingConfig cfg() { return {1000, 15000, 2000, 300000, 30000, 25, 1.5f, 0.8f, 3}; }
static LocationPayload fix(double lat, double lon, double speed) {
    LocationPayload p = {};
    p.latitude = lat; p.longitude = lon; p.speed_mps = speed; p.recorded_at[0] = 'x';
    return p;
}
void test_initial_interval_and_first_fix() {
    SamplingPolicy p(cfg()); TEST_ASSERT_TRUE(p.fixDue(0));
    SamplingDecision d = p.onFix(0, fix(0, 0, 5));
    TEST_ASSERT_EQUAL_UINT32(5000, d.nextFixPollMs);
    TEST_ASSERT_EQUAL(UploadReason::FIRST_VALID_FIX, d.uploadReason);
}
void test_speed_clamps() {
    struct Case { double speed; uint32_t expected; } cases[] = {
        {1.0, 15000}, {NAN, 2000}, {-1.0, 2000}, {INFINITY, 2000}
    };
    for (const Case& test : cases) {
        SamplingPolicy p(cfg());
        TEST_ASSERT_EQUAL_UINT32(test.expected, p.onFix(0, fix(0, 0, test.speed)).nextFixPollMs);
    }
    SamplingPolicy fast(cfg());
    fast.onFix(0, fix(0, 0, 100)); fast.onFix(2000, fix(0, 0, 100));
    TEST_ASSERT_EQUAL_UINT32(1000, fast.onFix(4000, fix(0, 0, 100)).nextFixPollMs);
}
void test_motion_confirmation_and_hysteresis() {
    SamplingPolicy p(cfg());
    p.onFix(0, fix(0, 0, 2)); p.onFix(2000, fix(0, 0, 2));
    TEST_ASSERT_EQUAL(MotionState::UNKNOWN, p.motionState());
    p.onFix(4000, fix(0, 0, 2)); TEST_ASSERT_EQUAL(MotionState::MOVING, p.motionState());
    p.onFix(5000, fix(0, 0, 1)); TEST_ASSERT_EQUAL(MotionState::MOVING, p.motionState());
}
void test_distance_and_failed_upload() {
    SamplingPolicy p(cfg()); p.onFix(0, fix(0, 0, 5)); p.onUploadResult(0, fix(0, 0, 5), true);
    TEST_ASSERT_EQUAL(UploadReason::DISTANCE_REACHED,
                      p.onFix(5000, fix(0, 0.0003, 5)).uploadReason);
    SamplingPolicy failed(cfg()); failed.onFix(0, fix(0, 0, 5));
    failed.onUploadResult(0, fix(0, 0, 5), false);
    TEST_ASSERT_EQUAL(UploadReason::FIRST_VALID_FIX,
                      failed.onFix(1, fix(0, 0.00001, 5)).uploadReason);
}
void test_heartbeat_and_wraparound() {
    SamplingPolicy p(cfg()); p.onFix(0, fix(0, 0, 0)); p.onFix(2000, fix(0, 0, 0));
    p.onFix(4000, fix(0, 0, 0)); p.onUploadResult(4000, fix(0, 0, 0), true);
    TEST_ASSERT_FALSE(p.onFix(299999, fix(0, 0, 0)).shouldUpload);
    TEST_ASSERT_EQUAL(UploadReason::STATIONARY_HEARTBEAT,
                      p.onFix(300000, fix(0, 0, 0)).uploadReason);
    SamplingPolicy wrap(cfg()); wrap.onFix(UINT32_MAX - 100, fix(0, 0, 5));
    TEST_ASSERT_TRUE(wrap.fixDue(1900));
}
void test_invalid_coordinates() {
    SamplingPolicy p(cfg()); TEST_ASSERT_FALSE(p.onFix(0, fix(91, 0, 5)).shouldUpload);
}
int main() {
    UNITY_BEGIN();
    RUN_TEST(test_initial_interval_and_first_fix); RUN_TEST(test_speed_clamps);
    RUN_TEST(test_motion_confirmation_and_hysteresis); RUN_TEST(test_distance_and_failed_upload);
    RUN_TEST(test_heartbeat_and_wraparound); RUN_TEST(test_invalid_coordinates);
    return UNITY_END();
}
