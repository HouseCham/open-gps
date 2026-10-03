#include <unity.h>
#include "vbat_sag.h"

void test_empty_tracker() {
    VbatSagTracker t;
    TEST_ASSERT_FALSE(t.hasSamples());
    TEST_ASSERT_EQUAL_UINT16(0, t.restBaselineMv());
    TEST_ASSERT_EQUAL_UINT16(0, t.sagMv(0));
    // In-range bucket exists but is empty; out-of-range is null.
    const VbatStats* empty = t.stats(0);
    TEST_ASSERT_NOT_NULL(empty);
    TEST_ASSERT_EQUAL_UINT16(0, empty->count);
    TEST_ASSERT_NULL(t.stats((uint8_t)VbatSagTracker::MAX_STATES));
}
void test_sample_min_max_avg_and_baseline() {
    VbatSagTracker t(4);
    t.sample(0, 4100);
    t.sample(0, 4050);
    t.sample(1, 3900);
    TEST_ASSERT_TRUE(t.hasSamples());
    TEST_ASSERT_EQUAL_UINT32(3, t.totalSamples());
    const VbatStats* s0 = t.stats(0);
    TEST_ASSERT_NOT_NULL(s0);
    TEST_ASSERT_EQUAL_UINT16(2, s0->count);
    TEST_ASSERT_EQUAL_UINT16(4050, s0->minMv);
    TEST_ASSERT_EQUAL_UINT16(4100, s0->maxMv);
    TEST_ASSERT_EQUAL_UINT16(4075, s0->avgMv());
    // Baseline is the highest sample anywhere (OCV proxy).
    TEST_ASSERT_EQUAL_UINT16(4100, t.restBaselineMv());
    // Sag for state 1: 4100 - 3900 = 200 mV.
    TEST_ASSERT_EQUAL_UINT16(200, t.sagMv(1));
    // State 0 min 4050 → sag 50 mV.
    TEST_ASSERT_EQUAL_UINT16(50, t.sagMv(0));
}
void test_invalid_samples_ignored() {
    VbatSagTracker t(2);
    t.sample(0, 0);    // zero = PMU settling / unknown
    t.sample(9, 4000); // out of range state
    TEST_ASSERT_FALSE(t.hasSamples());
    t.sample(1, 4000);
    TEST_ASSERT_EQUAL_UINT32(1, t.totalSamples());
}
void test_reset_clears_everything() {
    VbatSagTracker t(2);
    t.sample(0, 4200);
    t.sample(1, 3800);
    t.reset();
    TEST_ASSERT_FALSE(t.hasSamples());
    TEST_ASSERT_EQUAL_UINT16(0, t.restBaselineMv());
    TEST_ASSERT_EQUAL_UINT16(0, t.sagMv(1));
}
void test_state_count_clamped_to_max() {
    VbatSagTracker t(99);
    TEST_ASSERT_EQUAL_UINT32((uint32_t)VbatSagTracker::MAX_STATES, (uint32_t)t.stateCount());
    t.sample((uint8_t)(VbatSagTracker::MAX_STATES - 1), 4000);
    TEST_ASSERT_EQUAL_UINT32(1, t.totalSamples());
    t.sample((uint8_t)VbatSagTracker::MAX_STATES, 4000);
    TEST_ASSERT_EQUAL_UINT32(1, t.totalSamples());
}
int main() {
    UNITY_BEGIN();
    RUN_TEST(test_empty_tracker);
    RUN_TEST(test_sample_min_max_avg_and_baseline);
    RUN_TEST(test_invalid_samples_ignored);
    RUN_TEST(test_reset_clears_everything);
    RUN_TEST(test_state_count_clamped_to_max);
    return UNITY_END();
}
