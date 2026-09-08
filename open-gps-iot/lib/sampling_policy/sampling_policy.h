#pragma once

#include <stdint.h>

#include "location_payload.h"

enum class MotionState : uint8_t { UNKNOWN, STATIONARY, MOVING };
enum class UploadReason : uint8_t { NONE, FIRST_VALID_FIX, DISTANCE_REACHED,
                                    INTERVAL_ELAPSED, STATIONARY_HEARTBEAT };

struct SamplingConfig {
    uint32_t minFixPollMs;
    uint32_t maxFixPollMs;
    uint32_t unknownFixPollMs;
    uint32_t stationaryHeartbeatMs;
    uint32_t maxFixAgeMs;
    uint32_t targetPointSpacingM;
    float movingEnterMps;
    float movingExitMps;
    uint8_t stateConfirmationCount;
};

struct SamplingDecision {
    uint32_t nextFixPollMs;
    bool shouldUpload;
    UploadReason uploadReason;
    MotionState motionState;
};

class SamplingPolicy {
public:
    explicit SamplingPolicy(const SamplingConfig& config);
    bool fixDue(uint32_t nowMs) const;
    SamplingDecision onFix(uint32_t nowMs, const LocationPayload& fix);
    void onUploadResult(uint32_t nowMs, const LocationPayload& fix, bool sent);
    void notifyGpsReenabled(uint32_t nowMs);
    MotionState motionState() const { return _state; }

private:
    SamplingConfig _config;
    MotionState _state = MotionState::UNKNOWN;
    MotionState _candidate = MotionState::UNKNOWN;
    uint8_t _candidateCount = 0;
    uint32_t _lastPollMs = 0;
    uint32_t _lastSentMs = 0;
    uint32_t _pollIntervalMs;
    LocationPayload _lastSent = {};
    bool _hasSent = false;
    bool _hasPoll = false;
    bool _hasSentTime = false;

    static bool validCoordinates(const LocationPayload& fix);
    static bool validSpeed(double speed);
    uint32_t intervalForSpeed(double speed) const;
    double distanceM(const LocationPayload& fix) const;
};
