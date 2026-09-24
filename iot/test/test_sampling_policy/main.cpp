#include <cmath>
#include <cstdio>
#include <cstring>
#include <unity.h>
#include "sampling_policy.h"

static SamplingConfig cfg() { return {1000, 15000, 2000, 300000, 30000, 25, 1.5f, 0.8f, 3, 0.0, 0, 0.0}; }

static uint32_t fixSeq = 0;
static LocationPayload fix(double lat, double lon, double speed) {
    LocationPayload p = {};
    p.latitude = lat; p.longitude = lon; p.speed_mps = speed;
    // Unique second-resolution timestamp per call so stagnation never trips
    // across unrelated tests; tests that need a frozen clock use fixAt().
    snprintf(p.recorded_at, sizeof(p.recorded_at), "2026-01-01T%02u:%02u:%02uZ",
             (fixSeq / 3600u) % 24u, (fixSeq / 60u) % 60u, fixSeq % 60u);
    ++fixSeq;
    return p;
}
static LocationPayload fixAt(double lat, double lon, double speed, const char* ts) {
    LocationPayload p = fix(lat, lon, speed);
    snprintf(p.recorded_at, sizeof(p.recorded_at), "%s", ts);
    return p;
}

void test_initial_interval_and_first_fix() {
    SamplingPolicy p(cfg()); TEST_ASSERT_TRUE(p.fixDue(0));
    SamplingDecision d = p.onFix(0, fix(0, 0, 5));
    TEST_ASSERT_EQUAL_UINT32(5000, d.nextFixPollMs);
    TEST_ASSERT_EQUAL(UploadReason::FIRST_VALID_FIX, d.uploadReason);
    TEST_ASSERT_TRUE(d.fixAccepted);
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
void test_zero_speed_confirms_stationary() {
    SamplingPolicy p(cfg());
    p.onFix(0, fix(0, 0, 2)); p.onFix(1000, fix(0, 0, 2)); p.onFix(2000, fix(0, 0, 2));
    TEST_ASSERT_EQUAL(MotionState::MOVING, p.motionState());
    // v = 0.0 must be observed as STATIONARY (was broken: validSpeed required > 0).
    SamplingDecision d0 = p.onFix(3000, fix(0, 0, 0));
    TEST_ASSERT_EQUAL(MotionState::MOVING, p.motionState()); // not yet confirmed
    TEST_ASSERT_EQUAL_UINT32(15000, d0.nextFixPollMs);        // cadence already slows
    p.onFix(4000, fix(0, 0, 0));
    p.onFix(5000, fix(0, 0, 0));
    TEST_ASSERT_EQUAL(MotionState::STATIONARY, p.motionState());
    TEST_ASSERT_EQUAL_UINT32(15000, p.onFix(6000, fix(0, 0, 0)).nextFixPollMs);
}
void test_stagnant_timestamp_rejected() {
    SamplingPolicy p(cfg());
    const char* frozen = "2026-01-01T12:00:00Z";
    TEST_ASSERT_TRUE(p.onFix(0, fixAt(0, 0, 5, frozen)).fixAccepted);
    TEST_ASSERT_TRUE(p.onFix(10000, fixAt(0, 0, 5, frozen)).fixAccepted); // within 30 s
    SamplingDecision d = p.onFix(31000, fixAt(0, 0, 5, frozen));           // > 30 s
    TEST_ASSERT_FALSE(d.fixAccepted);
    TEST_ASSERT_FALSE(d.shouldUpload);
    TEST_ASSERT_TRUE(p.onFix(32000, fix(0, 0, 5)).fixAccepted); // fresh ts recovers
}
void test_quality_accuracy_and_satellites() {
    SamplingConfig c = cfg();
    c.maxAccuracyM = 50.0;
    c.minSatellites = 4;
    SamplingPolicy p(c);
    LocationPayload coarse = fix(0, 0, 5);
    coarse.accuracy_m = 120.0; coarse.satellites_used = 6;
    TEST_ASSERT_FALSE(p.onFix(0, coarse).fixAccepted);

    SamplingPolicy p2(c);
    LocationPayload fewSats = fix(0, 0, 5);
    fewSats.accuracy_m = 5.0; fewSats.satellites_used = 3;
    TEST_ASSERT_FALSE(p2.onFix(0, fewSats).fixAccepted);

    // Unknown (0) fields skip the gate.
    SamplingPolicy p3(c);
    TEST_ASSERT_TRUE(p3.onFix(0, fix(0, 0, 5)).fixAccepted);

    SamplingPolicy p4(c);
    LocationPayload good = fix(0, 0, 5);
    good.accuracy_m = 8.0; good.satellites_used = 9;
    TEST_ASSERT_TRUE(p4.onFix(0, good).fixAccepted);
}
void test_impossible_jump_rejected() {
    SamplingConfig c = cfg();
    c.maxSpeedMps = 500.0;
    SamplingPolicy p(c);
    TEST_ASSERT_TRUE(p.onFix(0, fix(0, 0, 5)).fixAccepted);
    // ~111 km in 1 s ≈ 111000 m/s ≫ 500 → reject.
    SamplingDecision d = p.onFix(1000, fix(0, 1.0, 5));
    TEST_ASSERT_FALSE(d.fixAccepted);
    TEST_ASSERT_FALSE(d.shouldUpload);
    // Prev stays at the last accepted fix; a plausible step from there passes.
    SamplingDecision d2 = p.onFix(2000, fix(0, 0.001, 5)); // ~111 m / 2 s
    TEST_ASSERT_TRUE(d2.fixAccepted);
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
    // Heartbeat is lastSent + interval — not "uptime past interval".
    TEST_ASSERT_FALSE(p.onFix(303999, fix(0, 0, 0)).shouldUpload);
    TEST_ASSERT_EQUAL(UploadReason::STATIONARY_HEARTBEAT,
                      p.onFix(304000, fix(0, 0, 0)).uploadReason);
    // Uptime > interval alone must not trip it when lastSent is recent.
    SamplingPolicy fresh(cfg()); fresh.onFix(0, fix(0, 0, 0));
    fresh.onUploadResult(400000, fix(0, 0, 0), true);
    TEST_ASSERT_FALSE(fresh.onFix(401000, fix(0, 0, 0)).shouldUpload);
    SamplingPolicy wrap(cfg()); wrap.onFix(UINT32_MAX - 100, fix(0, 0, 5));
    TEST_ASSERT_TRUE(wrap.fixDue(1900));
}
void test_invalid_coordinates_and_timestamp() {
    SamplingPolicy p(cfg());
    TEST_ASSERT_FALSE(p.onFix(0, fix(91, 0, 5)).fixAccepted);
    LocationPayload epoch = fix(0, 0, 5);
    std::memcpy(epoch.recorded_at, "0000-01-01T00:00:00Z", sizeof(epoch.recorded_at));
    TEST_ASSERT_FALSE(p.onFix(0, epoch).fixAccepted);
}
void test_radio_due_gate() {
    // Empty queue never opens the radio.
    TEST_ASSERT_FALSE(radioDue(0, 0, 0, false, MotionState::MOVING, 20, 30000, 60000));
    // Full batch opens regardless of motion / last open.
    TEST_ASSERT_TRUE(radioDue(1000, 20, 0, true, MotionState::STATIONARY, 20, 30000, 60000));
    // First open with pending points is immediate.
    TEST_ASSERT_TRUE(radioDue(0, 1, 0, false, MotionState::STATIONARY, 20, 30000, 60000));
    // Short of batch: wait for the motion-dependent flush interval.
    TEST_ASSERT_FALSE(radioDue(29999, 1, 0, true, MotionState::MOVING, 20, 30000, 60000));
    TEST_ASSERT_TRUE(radioDue(30000, 1, 0, true, MotionState::MOVING, 20, 30000, 60000));
    TEST_ASSERT_FALSE(radioDue(59999, 5, 0, true, MotionState::STATIONARY, 20, 30000, 60000));
    TEST_ASSERT_TRUE(radioDue(60000, 5, 0, true, MotionState::STATIONARY, 20, 30000, 60000));
    // millis wraparound: last open near UINT32_MAX, now wraps past flush.
    TEST_ASSERT_TRUE(radioDue(10000, 1, UINT32_MAX - 20000, true,
                              MotionState::MOVING, 20, 30000, 60000));
}
int main() {
    UNITY_BEGIN();
    RUN_TEST(test_initial_interval_and_first_fix); RUN_TEST(test_speed_clamps);
    RUN_TEST(test_motion_confirmation_and_hysteresis);
    RUN_TEST(test_zero_speed_confirms_stationary);
    RUN_TEST(test_stagnant_timestamp_rejected);
    RUN_TEST(test_quality_accuracy_and_satellites);
    RUN_TEST(test_impossible_jump_rejected);
    RUN_TEST(test_distance_and_failed_upload);
    RUN_TEST(test_heartbeat_and_wraparound);
    RUN_TEST(test_invalid_coordinates_and_timestamp);
    RUN_TEST(test_radio_due_gate);
    return UNITY_END();
}
