#include "connectivity_policy.h"
static bool due(uint32_t now, uint32_t deadline) { return static_cast<int32_t>(now - deadline) >= 0; }
ConnectivityPolicy::ConnectivityPolicy(uint32_t base, uint32_t max, uint8_t limit) : _base(base), _max(max), _limit(limit) {}
ConnectivityDecision ConnectivityPolicy::event(ConnectivityEvent event, uint32_t now) {
    if (event == ConnectivityEvent::UPLOAD_SUCCESS || event == ConnectivityEvent::PDP_OK) { _failures = 0; _state = ConnectivityState::READY; _deadline = now; return {ConnectivityAction::NONE, now}; }
    if (event == ConnectivityEvent::REGISTRATION_OK) return {ConnectivityAction::CONNECT_PDP, now};
    if (_failures < 255) ++_failures;
    if (_failures > _limit) { _state = ConnectivityState::FAILED; return {ConnectivityAction::NONE, now}; }
    const uint8_t shift = _failures > 6 ? 6 : static_cast<uint8_t>(_failures - 1);
    uint32_t delay = _base << shift; if (delay > _max) delay = _max;
    _state = ConnectivityState::BACKOFF; _deadline = now + delay; return {ConnectivityAction::CHECK, _deadline};
}
ConnectivityDecision ConnectivityPolicy::tick(uint32_t now) {
    if (_state != ConnectivityState::BACKOFF || !due(now, _deadline)) return {ConnectivityAction::NONE, _deadline};
    const bool restart = _failures >= 3; _state = restart ? ConnectivityState::RESTART_MODEM : ConnectivityState::RECONNECT_PDP;
    return {restart ? ConnectivityAction::RESTART_MODEM : ConnectivityAction::CONNECT_PDP, now};
}
