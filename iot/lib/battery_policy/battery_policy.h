#pragma once

#include <stdint.h>

// Low-battery hysteresis (Phase 3.6a). Enter when VBAT <= enterMv, exit only
// when VBAT >= exitMv — a single threshold would chatter around the trip
// point. Pure / host-testable; power_manager (3.5) will consume the flag.
class BatteryPolicy {
public:
    BatteryPolicy(uint16_t enterMv, uint16_t exitMv)
        : _enterMv(enterMv), _exitMv(exitMv) {}

    // Returns true when the low-battery state *changed* this call.
    bool update(uint16_t vbatMv);
    bool lowBattery() const { return _low; }

private:
    uint16_t _enterMv;
    uint16_t _exitMv;
    bool _low = false;
};
