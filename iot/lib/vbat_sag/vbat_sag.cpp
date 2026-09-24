#include "vbat_sag.h"

void VbatSagTracker::reset() {
    for (size_t i = 0; i < MAX_STATES; ++i) _buckets[i] = {};
    _baselineMv = 0;
    _total = 0;
}

void VbatSagTracker::sample(uint8_t state, uint16_t mv) {
    if (state >= _stateCount || mv == 0) return;
    VbatStats& s = _buckets[state];
    if (s.count == 0) {
        s.minMv = mv;
        s.maxMv = mv;
    } else {
        if (mv < s.minMv) s.minMv = mv;
        if (mv > s.maxMv) s.maxMv = mv;
    }
    ++s.count;
    s.sumMv += mv;
    ++_total;
    if (mv > _baselineMv) _baselineMv = mv;
}

const VbatStats* VbatSagTracker::stats(uint8_t state) const {
    if (state >= _stateCount) return nullptr;
    return &_buckets[state];
}

uint16_t VbatSagTracker::sagMv(uint8_t state) const {
    const VbatStats* s = stats(state);
    if (!s || s->count == 0 || _baselineMv == 0 || s->minMv >= _baselineMv) return 0;
    return static_cast<uint16_t>(_baselineMv - s->minMv);
}
