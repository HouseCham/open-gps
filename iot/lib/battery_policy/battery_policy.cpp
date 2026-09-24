#include "battery_policy.h"

bool BatteryPolicy::update(uint16_t vbatMv) {
    if (vbatMv == 0) return false; // PMU settling / unknown — do not trip
    if (!_low && vbatMv <= _enterMv) {
        _low = true;
        return true;
    }
    if (_low && vbatMv >= _exitMv) {
        _low = false;
        return true;
    }
    return false;
}
