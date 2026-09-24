#pragma once

#include <stdint.h>

// Power profiles for Phase 3.5. The manager only *decides* what may run;
// actuators (DTR, rails, deep sleep) stay behind compile-time flags that
// ship disabled until Hologram timers + HIL wake are proven.
enum class PowerProfile : uint8_t {
    MOVING,
    STATIONARY,
    NO_NETWORK,
    LOW_BATTERY,
    CHARGING
};

// What the manager allows right now — all false when the corresponding
// build flag is off (production default until 3.5 HIL sign-off).
struct PowerDecision {
    bool allowModemDtr;   // modem sleep via DTR when idle
    bool allowDeepSleep;  // ESP32 deep sleep between heartbeats
    bool allowPsmEdrx;    // network PSM/eDRX (needs granted timers)
    bool wantUpload;      // false → radio may stay closed this profile
};

struct PowerConfig {
    bool modemDtrEnabled;
    bool deepSleepEnabled;
    bool psmEdrxEnabled;
    uint32_t stationaryDeepSleepMs; // min dwell before deep sleep candidate
};

// Pure: maps (profile, lowBattery, charging, uptime) → allowed actions.
// Does not touch hardware; main.cpp applies decisions once flags are on.
class PowerManager {
public:
    explicit PowerManager(const PowerConfig& config) : _config(config) {}

    PowerDecision decide(PowerProfile profile, uint32_t nowMs,
                         uint32_t profileSinceMs) const;
    static const char* profileName(PowerProfile profile);

private:
    PowerConfig _config;
};
