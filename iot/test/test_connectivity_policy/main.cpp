#include <unity.h>
#include "connectivity_policy.h"
constexpr uint32_t BASE_BACKOFF_MS = 100;
constexpr uint32_t MAX_BACKOFF_MS = 800;
constexpr uint8_t MAX_FAILURES = 4;
constexpr uint32_t INITIAL_TIME_MS = 0;
constexpr uint32_t SUCCESS_TIME_MS = 10;
constexpr uint32_t WRAPPED_START_MS = 0xFFFFFFF0u;
constexpr uint32_t WRAPPED_DEADLINE_MS = 84;
ConnectivityPolicy policy() { return ConnectivityPolicy(BASE_BACKOFF_MS, MAX_BACKOFF_MS, MAX_FAILURES); }
void test_success_resets_failures() { auto p = policy(); p.event(ConnectivityEvent::TRANSPORT_FAILURE, INITIAL_TIME_MS); p.event(ConnectivityEvent::UPLOAD_SUCCESS, SUCCESS_TIME_MS); TEST_ASSERT_TRUE(p.ready()); TEST_ASSERT_EQUAL_UINT8(0, p.failures()); }
void test_backoff_and_escalation() { auto p = policy(); TEST_ASSERT_EQUAL_UINT32(BASE_BACKOFF_MS, p.event(ConnectivityEvent::TRANSPORT_FAILURE, INITIAL_TIME_MS).deadlineMs); TEST_ASSERT_EQUAL(ConnectivityAction::CONNECT_PDP, p.tick(BASE_BACKOFF_MS).action); p.event(ConnectivityEvent::TRANSPORT_FAILURE, 100); p.event(ConnectivityEvent::TRANSPORT_FAILURE, 300); p.event(ConnectivityEvent::TRANSPORT_FAILURE, 700); TEST_ASSERT_EQUAL(ConnectivityAction::RESTART_MODEM, p.tick(1500).action); }
void test_wraparound_deadline() { auto p = policy(); p.event(ConnectivityEvent::TRANSPORT_FAILURE, WRAPPED_START_MS); TEST_ASSERT_EQUAL(ConnectivityAction::CONNECT_PDP, p.tick(WRAPPED_DEADLINE_MS).action); }
int main() { UNITY_BEGIN(); RUN_TEST(test_success_resets_failures); RUN_TEST(test_backoff_and_escalation); RUN_TEST(test_wraparound_deadline); return UNITY_END(); }
