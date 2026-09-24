#include <unity.h>
#include "battery_policy.h"

void test_starts_not_low() {
    BatteryPolicy p(3400, 3600);
    TEST_ASSERT_FALSE(p.lowBattery());
}
void test_enter_at_or_below_threshold() {
    BatteryPolicy p(3400, 3600);
    TEST_ASSERT_FALSE(p.update(3401)); // still above
    TEST_ASSERT_TRUE(p.update(3400));  // at enter → trip
    TEST_ASSERT_TRUE(p.lowBattery());
}
void test_hysteresis_no_chatter_between_thresholds() {
    BatteryPolicy p(3400, 3600);
    TEST_ASSERT_TRUE(p.update(3400));
    // Bounce in the dead band: no exit, no re-enter flip-flop.
    TEST_ASSERT_FALSE(p.update(3500));
    TEST_ASSERT_FALSE(p.update(3450));
    TEST_ASSERT_TRUE(p.lowBattery());
    TEST_ASSERT_FALSE(p.update(3599));
    TEST_ASSERT_TRUE(p.lowBattery());
}
void test_exit_at_or_above_threshold() {
    BatteryPolicy p(3400, 3600);
    TEST_ASSERT_TRUE(p.update(3300));
    TEST_ASSERT_TRUE(p.update(3600)); // at exit → clear
    TEST_ASSERT_FALSE(p.lowBattery());
}
void test_zero_mV_ignored() {
    BatteryPolicy p(3400, 3600);
    TEST_ASSERT_FALSE(p.update(0));
    TEST_ASSERT_FALSE(p.lowBattery());
    TEST_ASSERT_TRUE(p.update(3400));
    TEST_ASSERT_FALSE(p.update(0)); // unknown while low → stay low
    TEST_ASSERT_TRUE(p.lowBattery());
}
void test_reenter_after_recovery_drops_again() {
    BatteryPolicy p(3400, 3600);
    TEST_ASSERT_TRUE(p.update(3200));
    TEST_ASSERT_TRUE(p.update(3700));
    TEST_ASSERT_TRUE(p.update(3400)); // second trip reports the edge
    TEST_ASSERT_TRUE(p.lowBattery());
}
int main() {
    UNITY_BEGIN();
    RUN_TEST(test_starts_not_low);
    RUN_TEST(test_enter_at_or_below_threshold);
    RUN_TEST(test_hysteresis_no_chatter_between_thresholds);
    RUN_TEST(test_exit_at_or_above_threshold);
    RUN_TEST(test_zero_mV_ignored);
    RUN_TEST(test_reenter_after_recovery_drops_again);
    return UNITY_END();
}
