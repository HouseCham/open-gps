#pragma once

#include <stddef.h>
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
    uint32_t maxFixAgeMs;   // same GNSS timestamp longer than this → reject; 0 = off
    uint32_t targetPointSpacingM;
    float movingEnterMps;
    float movingExitMps;
    uint8_t stateConfirmationCount;
    double maxAccuracyM;    // reject known accuracy above this; 0 = off
    uint16_t minSatellites; // reject known sats_used below this; 0 = off
    double maxSpeedMps;     // implied jump speed guard vs previous fix; 0 = off
};

struct SamplingDecision {
    uint32_t nextFixPollMs;
    bool shouldUpload;
    UploadReason uploadReason;
    MotionState motionState;
    bool fixAccepted; // false → failed validation; ignore for motion/upload
};

// True when the radio may open to drain the queue: non-empty AND (batch full
// OR first open OR flush interval since last open elapsed for this motion).
// Pure / wrap-safe; thresholds come from the caller (config.h on device).
bool radioDue(uint32_t nowMs, size_t queueSize, uint32_t lastOpenMs,
              bool hasOpened, MotionState state, size_t batchMinItems,
              uint32_t flushMsMoving, uint32_t flushMsStationary);

class SamplingPolicy {
public:
    explicit SamplingPolicy(const SamplingConfig& config);
    bool fixDue(uint32_t nowMs) const;
    SamplingDecision onFix(uint32_t nowMs, const LocationPayload& fix);
    void onUploadResult(uint32_t nowMs, const LocationPayload& fix, bool sent);
    // Call after GNSS re-enable (upload radio gap): next fixDue() fires
    // immediately so a warm TTFF refreshes position without waiting a full
    // interval. Use `_lastPollMs = nowMs` instead to wait the full interval.
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
    char _lastRecordedAt[FIX_TIMESTAMP_LENGTH] = {};
    uint32_t _lastTimestampChangeMs = 0;
    bool _hasTimestamp = false;
    double _prevLat = 0.0;
    double _prevLon = 0.0;
    uint32_t _prevFixMs = 0;
    bool _hasPrevFix = false;

    static bool validCoordinates(const LocationPayload& fix);
    static bool validSpeed(double speed);
    uint32_t intervalForSpeed(double speed) const;
    double distanceM(const LocationPayload& fix) const;
    static double haversineM(double lat1, double lon1, double lat2, double lon2);
};
