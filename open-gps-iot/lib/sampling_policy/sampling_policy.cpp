#include "sampling_policy.h"

#include <cmath>

namespace {
constexpr double EARTH_RADIUS_M = 6371000.0;
constexpr double PI = 3.14159265358979323846;
}

SamplingPolicy::SamplingPolicy(const SamplingConfig& config)
    : _config(config), _pollIntervalMs(config.unknownFixPollMs) {}

bool SamplingPolicy::fixDue(uint32_t nowMs) const {
    return !_hasPoll || static_cast<uint32_t>(nowMs - _lastPollMs) >= _pollIntervalMs;
}

bool SamplingPolicy::validCoordinates(const LocationPayload& fix) {
    return std::isfinite(fix.latitude) && std::isfinite(fix.longitude) &&
           fix.latitude >= -90.0 && fix.latitude <= 90.0 &&
           fix.longitude >= -180.0 && fix.longitude <= 180.0 &&
           fix.recorded_at[0] != '\0';
}

bool SamplingPolicy::validSpeed(double speed) {
    return std::isfinite(speed) && speed > 0.0;
}

uint32_t SamplingPolicy::intervalForSpeed(double speed) const {
    if (!validSpeed(speed)) return _config.unknownFixPollMs;
    const double rawMs = (static_cast<double>(_config.targetPointSpacingM) / speed) * 1000.0;
    if (rawMs <= _config.minFixPollMs) return _config.minFixPollMs;
    if (rawMs >= _config.maxFixPollMs) return _config.maxFixPollMs;
    return static_cast<uint32_t>(rawMs + 0.5);
}

double SamplingPolicy::distanceM(const LocationPayload& fix) const {
    if (!_hasSent || !validCoordinates(fix) || !validCoordinates(_lastSent)) return -1.0;
    const double lat1 = _lastSent.latitude * PI / 180.0;
    const double lat2 = fix.latitude * PI / 180.0;
    const double dLat = (fix.latitude - _lastSent.latitude) * PI / 180.0;
    const double dLon = (fix.longitude - _lastSent.longitude) * PI / 180.0;
    const double a = std::sin(dLat / 2) * std::sin(dLat / 2) +
                     std::cos(lat1) * std::cos(lat2) *
                     std::sin(dLon / 2) * std::sin(dLon / 2);
    return EARTH_RADIUS_M * 2.0 * std::asin(std::sqrt(a < 1.0 ? a : 1.0));
}

SamplingDecision SamplingPolicy::onFix(uint32_t nowMs, const LocationPayload& fix) {
    _lastPollMs = nowMs;
    _hasPoll = true;
    SamplingDecision result = {_pollIntervalMs, false, UploadReason::NONE, _state};
    if (!validCoordinates(fix)) return result;

    MotionState observed = _state;
    if (_state != MotionState::MOVING && std::isfinite(fix.speed_mps) &&
        fix.speed_mps >= _config.movingEnterMps) observed = MotionState::MOVING;
    else if (_state == MotionState::UNKNOWN && std::isfinite(fix.speed_mps) &&
             fix.speed_mps < _config.movingEnterMps) observed = MotionState::STATIONARY;
    else if (_state == MotionState::MOVING && validSpeed(fix.speed_mps) &&
             fix.speed_mps <= _config.movingExitMps) observed = MotionState::STATIONARY;
    if (observed != _state && observed != MotionState::UNKNOWN) {
        if (_candidate != observed) { _candidate = observed; _candidateCount = 1; }
        else if (_candidateCount < 255) ++_candidateCount;
        if (_candidateCount >= _config.stateConfirmationCount) {
            _state = observed; _candidate = MotionState::UNKNOWN; _candidateCount = 0;
        }
    } else if (observed == _state) { _candidate = MotionState::UNKNOWN; _candidateCount = 0; }

    _pollIntervalMs = _state == MotionState::STATIONARY ? _config.maxFixPollMs :
                       _state == MotionState::MOVING ? intervalForSpeed(fix.speed_mps) :
                       _config.unknownFixPollMs;
    result.nextFixPollMs = _pollIntervalMs;
    result.motionState = _state;
    if (!_hasSent) { result.shouldUpload = true; result.uploadReason = UploadReason::FIRST_VALID_FIX; return result; }
    const double distance = distanceM(fix);
    if (_state == MotionState::MOVING && distance >= _config.targetPointSpacingM) {
        result.shouldUpload = true; result.uploadReason = UploadReason::DISTANCE_REACHED;
    } else if (_state == MotionState::MOVING && _hasSentTime &&
               static_cast<uint32_t>(nowMs - _lastSentMs) >= _pollIntervalMs) {
        result.shouldUpload = true; result.uploadReason = UploadReason::INTERVAL_ELAPSED;
    } else if (_state == MotionState::STATIONARY && _hasSentTime &&
               static_cast<uint32_t>(nowMs - _lastSentMs) >= _config.stationaryHeartbeatMs) {
        result.shouldUpload = true; result.uploadReason = UploadReason::STATIONARY_HEARTBEAT;
    }
    return result;
}

void SamplingPolicy::onUploadResult(uint32_t nowMs, const LocationPayload& fix, bool sent) {
    if (!sent) return;
    _lastSent = fix; _lastSentMs = nowMs; _hasSent = true; _hasSentTime = true;
}

void SamplingPolicy::notifyGpsReenabled(uint32_t nowMs) {
    _lastPollMs = nowMs - _pollIntervalMs;
}
