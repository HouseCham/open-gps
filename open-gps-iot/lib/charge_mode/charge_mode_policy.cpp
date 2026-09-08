#include "charge_mode_policy.h"

bool ChargeModePolicy::update(uint32_t nowMs, uint16_t vbusMv) {
    bool thresholdCandidate;
    if (vbusMv >= _presentThresholdMv) {
        thresholdCandidate = true;
    } else if (vbusMv <= _absentThresholdMv) {
        thresholdCandidate = false;
    } else {
        return _stablePresent;
    }

    if (!_candidateInitialized || thresholdCandidate != _candidatePresent) {
        _candidatePresent = thresholdCandidate;
        _candidateSinceMs = nowMs;
        _candidateInitialized = true;
    }

    _initialized = true;

    if (static_cast<uint32_t>(nowMs - _candidateSinceMs) >= _debounceMs) {
        _stablePresent = _candidatePresent;
    }
    return _stablePresent;
}
