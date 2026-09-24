#pragma once

#include <stddef.h>
#include <stdint.h>

// Per-state VBAT stats for the Phase 3.4 sag-proxy session. Pure; the device
// feeds getBattVoltage() samples tagged with a small state id.
struct VbatStats {
    uint16_t count;
    uint16_t minMv;
    uint16_t maxMv;
    uint32_t sumMv;

    uint16_t avgMv() const {
        return count ? static_cast<uint16_t>(sumMv / count) : 0;
    }
};

// Fixed-bucket tracker: one VbatStats per state id in [0, capacity).
// Rest baseline = highest sample seen across all states (best-effort OCV
// proxy while idle); sag(state) = baseline - min(state).
class VbatSagTracker {
public:
    static constexpr size_t MAX_STATES = 16;

    explicit VbatSagTracker(size_t stateCount = MAX_STATES)
        : _stateCount(stateCount > MAX_STATES ? MAX_STATES : stateCount) {}

    void reset();
    void sample(uint8_t state, uint16_t mv);
    bool hasSamples() const { return _total > 0; }
    size_t stateCount() const { return _stateCount; }
    const VbatStats* stats(uint8_t state) const;
    uint16_t restBaselineMv() const { return _baselineMv; }
    // 0 when no samples or state empty.
    uint16_t sagMv(uint8_t state) const;
    size_t totalSamples() const { return _total; }

private:
    VbatStats _buckets[MAX_STATES] = {};
    size_t _stateCount;
    uint16_t _baselineMv = 0;
    size_t _total = 0;
};
