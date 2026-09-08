#include <unity.h>
#include "charge_mode_policy.h"

void test_debounce_and_hysteresis() {
    ChargeModePolicy p(4500, 4000, 2000);
    TEST_ASSERT_FALSE(p.update(0, 5000));
    TEST_ASSERT_FALSE(p.update(1999, 5000));
    TEST_ASSERT_TRUE(p.update(2000, 5000));
    TEST_ASSERT_TRUE(p.update(3000, 4300));
    TEST_ASSERT_TRUE(p.update(3999, 3900));
    TEST_ASSERT_TRUE(p.update(5000, 3900));
    TEST_ASSERT_FALSE(p.update(5999, 3900));
}

void test_wraparound() {
    ChargeModePolicy p(4500, 4000, 100);
    TEST_ASSERT_FALSE(p.update(UINT32_MAX - 50, 5000));
    TEST_ASSERT_TRUE(p.update(49, 5000));
}

void setup() { UNITY_BEGIN(); RUN_TEST(test_debounce_and_hysteresis); RUN_TEST(test_wraparound); UNITY_END(); }
void loop() {}
