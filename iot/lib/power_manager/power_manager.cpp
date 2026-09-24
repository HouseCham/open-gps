#include "power_manager.h"

const char* PowerManager::profileName(PowerProfile profile) {
    switch (profile) {
        case PowerProfile::MOVING: return "MOVING";
        case PowerProfile::STATIONARY: return "STATIONARY";
        case PowerProfile::NO_NETWORK: return "NO_NETWORK";
        case PowerProfile::LOW_BATTERY: return "LOW_BATTERY";
        case PowerProfile::CHARGING: return "CHARGING";
    }
    return "?";
}

PowerDecision PowerManager::decide(PowerProfile profile, uint32_t nowMs,
                                   uint32_t profileSinceMs) const {
    // Defaults: never open upload path from a power-profile decision alone;
    // main.cpp still owns the radioDue gate for actual sends.
    PowerDecision d{false, false, false, false};

    const bool longDwell =
        static_cast<uint32_t>(nowMs - profileSinceMs) >= _config.stationaryDeepSleepMs;

    switch (profile) {
        case PowerProfile::MOVING:
            // Active tracking: no deep sleep; DTR only if explicitly enabled.
            d.allowModemDtr = _config.modemDtrEnabled;
            d.wantUpload = true;
            break;
        case PowerProfile::STATIONARY:
            d.allowModemDtr = _config.modemDtrEnabled;
            d.allowDeepSleep = _config.deepSleepEnabled && longDwell;
            d.wantUpload = true;
            break;
        case PowerProfile::NO_NETWORK:
            // No point burning radio on upload; keep GNSS sampling policy as-is.
            d.allowModemDtr = _config.modemDtrEnabled;
            d.allowDeepSleep = _config.deepSleepEnabled && longDwell;
            break;
        case PowerProfile::LOW_BATTERY:
            // Reduce activity first; deep sleep only when the flag is on and
            // the device has been in this profile long enough to settle.
            d.allowModemDtr = _config.modemDtrEnabled;
            d.allowDeepSleep = _config.deepSleepEnabled && longDwell;
            break;
        case PowerProfile::CHARGING:
            // Charge-only path never reaches here (runChargeOnlyMode), but if
            // it does: no sleep, no upload — wait for VBUS removal.
            return d; // early: no PSM/eDRX while on charger
    }

    // PSM/eDRX stays gated by its own flag for every non-charging profile;
    // it is the last switch to flip after Hologram grants timers (plan 3.5).
    d.allowPsmEdrx = _config.psmEdrxEnabled;
    return d;
}
