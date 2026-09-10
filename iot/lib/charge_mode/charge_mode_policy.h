#pragma once

#include <stdint.h>

class ChargeModePolicy {
public:
    ChargeModePolicy(uint32_t presentThresholdMv, uint32_t absentThresholdMv,
                     uint32_t debounceMs)
        : _presentThresholdMv(presentThresholdMv),
          _absentThresholdMv(absentThresholdMv), _debounceMs(debounceMs) {}

    bool update(uint32_t nowMs, uint16_t vbusMv);
    bool present() const { return _stablePresent; }

private:
    uint32_t _presentThresholdMv;
    uint32_t _absentThresholdMv;
    uint32_t _debounceMs;
    uint32_t _candidateSinceMs = 0;
    bool _stablePresent = false;
    bool _candidatePresent = false;
    bool _candidateInitialized = false;
    bool _initialized = false;
};
