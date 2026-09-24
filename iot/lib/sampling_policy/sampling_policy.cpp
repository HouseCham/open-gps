#include "sampling_policy.h"

#include <cmath>
#include <cstring>

namespace {
constexpr double EARTH_RADIUS_M = 6371000.0;
constexpr double PI = 3.14159265358979323846;
}

SamplingPolicy::SamplingPolicy(const SamplingConfig& config)
    : _config(config), _pollIntervalMs(config.unknownFixPollMs) {}

bool SamplingPolicy::fixDue(uint32_t nowMs) const {
    return !_hasPoll || nowMs < _lastPollMs ||
           static_cast<uint32_t>(nowMs - _lastPollMs) >= _pollIntervalMs;
}

bool SamplingPolicy::validCoordinates(const LocationPayload& fix) {
    return std::isfinite(fix.latitude) && std::isfinite(fix.longitude) &&
           fix.latitude >= -90.0 && fix.latitude <= 90.0 &&
           fix.longitude >= -180.0 && fix.longitude <= 180.0 &&
           fix.recorded_at[0] != '\0' &&
           // Year cannot start with '0' for a live tracker (rejects 0000-…).
           fix.recorded_at[0] != '0';
}

// 0.0 is a real speed (stopped). Only non-finite or negative is invalid.
bool SamplingPolicy::validSpeed(double speed) {
    return std::isfinite(speed) && speed >= 0.0;
}

uint32_t SamplingPolicy::intervalForSpeed(double speed) const {
    // Spacing math needs a strictly positive speed; 0 falls back to the
    // unknown cadence (the stationary path uses maxFixPollMs instead).
    if (!std::isfinite(speed) || speed <= 0.0) return _config.unknownFixPollMs;
    const double rawMs = (static_cast<double>(_config.targetPointSpacingM) / speed) * 1000.0;
    if (rawMs <= _config.minFixPollMs) return _config.minFixPollMs;
    if (rawMs >= _config.maxFixPollMs) return _config.maxFixPollMs;
    return static_cast<uint32_t>(rawMs + 0.5);
}

double SamplingPolicy::haversineM(double lat1, double lon1,
                                  double lat2, double lon2) {
    const double la1 = lat1 * PI / 180.0;
    const double la2 = lat2 * PI / 180.0;
    const double dLat = (lat2 - lat1) * PI / 180.0;
    const double dLon = (lon2 - lon1) * PI / 180.0;
    const double a = std::sin(dLat / 2) * std::sin(dLat / 2) +
                     std::cos(la1) * std::cos(la2) *
                     std::sin(dLon / 2) * std::sin(dLon / 2);
    return EARTH_RADIUS_M * 2.0 * std::asin(std::sqrt(a < 1.0 ? a : 1.0));
}

double SamplingPolicy::distanceM(const LocationPayload& fix) const {
    if (!_hasSent || !validCoordinates(fix) || !validCoordinates(_lastSent)) return -1.0;
    return haversineM(_lastSent.latitude, _lastSent.longitude,
                      fix.latitude, fix.longitude);
}

SamplingDecision SamplingPolicy::onFix(uint32_t nowMs, const LocationPayload& fix) {
    _lastPollMs = nowMs;
    _hasPoll = true;
    SamplingDecision result = {_pollIntervalMs, false, UploadReason::NONE,
                               _state, true};
    if (!validCoordinates(fix)) {
        result.fixAccepted = false;
        return result;
    }

    // Stagnation: same GNSS timestamp for longer than maxFixAgeMs (wall-clock
    // via millis deltas of successive polls — never RFC3339 vs millis()).
    if (!_hasTimestamp || std::strcmp(fix.recorded_at, _lastRecordedAt) != 0) {
        std::strncpy(_lastRecordedAt, fix.recorded_at, sizeof(_lastRecordedAt) - 1);
        _lastRecordedAt[sizeof(_lastRecordedAt) - 1] = '\0';
        _lastTimestampChangeMs = nowMs;
        _hasTimestamp = true;
    } else if (_config.maxFixAgeMs > 0 &&
               static_cast<uint32_t>(nowMs - _lastTimestampChangeMs) > _config.maxFixAgeMs) {
        result.fixAccepted = false;
        return result;
    }

    // Quality gates: only when the field is known (0 = unknown → skip).
    if (_config.maxAccuracyM > 0.0 && fix.accuracy_m > 0.0 &&
        fix.accuracy_m > _config.maxAccuracyM) {
        result.fixAccepted = false;
        return result;
    }
    if (_config.minSatellites > 0 && fix.satellites_used > 0 &&
        fix.satellites_used < _config.minSatellites) {
        result.fixAccepted = false;
        return result;
    }

    // Impossible jump: implied ground speed since the previous accepted fix.
    if (_config.maxSpeedMps > 0.0 && _hasPrevFix) {
        const uint32_t dtMs = nowMs - _prevFixMs;
        if (dtMs > 0) {
            const double implied = haversineM(_prevLat, _prevLon,
                                              fix.latitude, fix.longitude) /
                                   (dtMs / 1000.0);
            if (implied > _config.maxSpeedMps) {
                result.fixAccepted = false;
                return result;
            }
        }
    }

    _prevLat = fix.latitude;
    _prevLon = fix.longitude;
    _prevFixMs = nowMs;
    _hasPrevFix = true;

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

    // Use the current observation while hysteresis confirms the new state.
    const MotionState effectiveState = observed == MotionState::UNKNOWN ? _state : observed;
    const bool stationaryObservation = effectiveState == MotionState::STATIONARY &&
                                       (_state != MotionState::UNKNOWN || validSpeed(fix.speed_mps));
    _pollIntervalMs = stationaryObservation ? _config.maxFixPollMs :
                       effectiveState == MotionState::MOVING ? intervalForSpeed(fix.speed_mps) :
                       _config.unknownFixPollMs;
    result.nextFixPollMs = _pollIntervalMs;
    result.motionState = _state;
    if (!_hasSent) { result.shouldUpload = true; result.uploadReason = UploadReason::FIRST_VALID_FIX; return result; }
    const double distance = distanceM(fix);
    if (effectiveState == MotionState::MOVING && distance >= _config.targetPointSpacingM) {
        result.shouldUpload = true; result.uploadReason = UploadReason::DISTANCE_REACHED;
    } else if (effectiveState == MotionState::MOVING && _hasSentTime &&
               static_cast<uint32_t>(nowMs - _lastSentMs) >= _pollIntervalMs) {
        result.shouldUpload = true; result.uploadReason = UploadReason::INTERVAL_ELAPSED;
    } else if (effectiveState == MotionState::STATIONARY && _hasSentTime &&
               static_cast<uint32_t>(nowMs - _lastSentMs) >= _config.stationaryHeartbeatMs) {
        // Wrap-safe delta only. The old `nowMs >= stationaryHeartbeatMs`
        // clause made this fire on EVERY fix once uptime passed the interval
        // (4 pts/min instead of 1/5 min on device).
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

bool radioDue(uint32_t nowMs, size_t queueSize, uint32_t lastOpenMs,
              bool hasOpened, MotionState state, size_t batchMinItems,
              uint32_t flushMsMoving, uint32_t flushMsStationary) {
    if (queueSize == 0) return false;
    if (batchMinItems > 0 && queueSize >= batchMinItems) return true;
    if (!hasOpened) return true;
    const uint32_t flushMs =
        state == MotionState::MOVING ? flushMsMoving : flushMsStationary;
    return static_cast<uint32_t>(nowMs - lastOpenMs) >= flushMs;
}
