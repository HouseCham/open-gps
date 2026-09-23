#pragma once
#include <stdint.h>
enum class ConnectivityState : uint8_t { IDLE, READY, BACKOFF, RECONNECT_PDP, RESTART_MODEM, FAILED };
enum class ConnectivityEvent : uint8_t { REGISTRATION_OK, PDP_OK, TRANSPORT_FAILURE, UPLOAD_SUCCESS };
enum class ConnectivityAction : uint8_t { NONE, CHECK, CONNECT_PDP, RESTART_MODEM };
struct ConnectivityDecision { ConnectivityAction action; uint32_t deadlineMs; };
class ConnectivityPolicy {
public:
    ConnectivityPolicy(uint32_t base, uint32_t max, uint8_t limit);
    ConnectivityDecision event(ConnectivityEvent event, uint32_t now);
    ConnectivityDecision tick(uint32_t now);
    bool ready() const { return _state == ConnectivityState::READY; }
    uint8_t failures() const { return _failures; }
private:
    uint32_t _base, _max, _deadline = 0; uint8_t _limit, _failures = 0;
    ConnectivityState _state = ConnectivityState::IDLE;
};
