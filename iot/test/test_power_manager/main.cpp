#include <unity.h>
#include "power_manager.h"

static PowerConfig cfg(bool dtr, bool deep, bool psm) {
    return {dtr, deep, psm, 60000};
}

void test_all_flags_off_by_default() {
    PowerManager m(cfg(false, false, false));
    PowerDecision d = m.decide(PowerProfile::MOVING, 100000, 0);
    TEST_ASSERT_FALSE(d.allowModemDtr);
    TEST_ASSERT_FALSE(d.allowDeepSleep);
    TEST_ASSERT_FALSE(d.allowPsmEdrx);
    TEST_ASSERT_TRUE(d.wantUpload);
}
void test_moving_never_deep_sleeps() {
    PowerManager m(cfg(true, true, true));
    PowerDecision d = m.decide(PowerProfile::MOVING, 1000000, 0);
    TEST_ASSERT_TRUE(d.allowModemDtr);
    TEST_ASSERT_FALSE(d.allowDeepSleep); // moving ignores dwell
    TEST_ASSERT_TRUE(d.allowPsmEdrx);
}
void test_stationary_deep_sleep_requires_dwell() {
    PowerManager m(cfg(false, true, false));
    PowerDecision early = m.decide(PowerProfile::STATIONARY, 30000, 0);
    TEST_ASSERT_FALSE(early.allowDeepSleep);
    PowerDecision late = m.decide(PowerProfile::STATIONARY, 60000, 0);
    TEST_ASSERT_TRUE(late.allowDeepSleep);
}
void test_no_network_skips_upload() {
    PowerManager m(cfg(true, true, true));
    PowerDecision d = m.decide(PowerProfile::NO_NETWORK, 120000, 0);
    TEST_ASSERT_FALSE(d.wantUpload);
    TEST_ASSERT_TRUE(d.allowDeepSleep);
}
void test_low_battery_uses_deep_sleep_when_allowed() {
    PowerManager off(cfg(false, false, false));
    PowerDecision blocked = off.decide(PowerProfile::LOW_BATTERY, 200000, 0);
    TEST_ASSERT_FALSE(blocked.allowDeepSleep);
    PowerManager on(cfg(false, true, false));
    PowerDecision allowed = on.decide(PowerProfile::LOW_BATTERY, 200000, 0);
    TEST_ASSERT_TRUE(allowed.allowDeepSleep);
}
void test_charging_no_actions() {
    PowerManager m(cfg(true, true, true));
    PowerDecision d = m.decide(PowerProfile::CHARGING, 5000, 0);
    TEST_ASSERT_FALSE(d.allowModemDtr);
    TEST_ASSERT_FALSE(d.allowDeepSleep);
    TEST_ASSERT_FALSE(d.allowPsmEdrx);
    TEST_ASSERT_FALSE(d.wantUpload);
}
void test_profile_names() {
    TEST_ASSERT_EQUAL_STRING("MOVING", PowerManager::profileName(PowerProfile::MOVING));
    TEST_ASSERT_EQUAL_STRING("CHARGING", PowerManager::profileName(PowerProfile::CHARGING));
}
int main() {
    UNITY_BEGIN();
    RUN_TEST(test_all_flags_off_by_default);
    RUN_TEST(test_moving_never_deep_sleeps);
    RUN_TEST(test_stationary_deep_sleep_requires_dwell);
    RUN_TEST(test_no_network_skips_upload);
    RUN_TEST(test_low_battery_uses_deep_sleep_when_allowed);
    RUN_TEST(test_charging_no_actions);
    RUN_TEST(test_profile_names);
    return UNITY_END();
}
