#pragma once

#include <Arduino.h>

#include "location_payload.h"

#define XPOWERS_CHIP_AXP2101
#include <XPowersLib.h>
#include <TinyGsmClient.h>

// Single-class wrapper around the LilyGo T-SIM7080G-S3 GPS bring-up:
// PMU prologue, modem power-on, AT handshake, GNSS enable, fix poll.
// Owns one TinyGsm instance backed by Serial1 (UART1) and one XPowersPMU
// instance backed by Wire (AXP2101 @ 0x34).
class GpsBoard {
public:
    enum class ChargerState : uint8_t { UNKNOWN, NO_VBUS, CHARGING, CHARGE_COMPLETE, FAULT };

    bool beginPmuOnly();
    bool beginTrackerHardware();
    // Runs the full board bring-up. Returns false if PMU fails to come up
    // or the modem does not respond to AT within ~15 s.
    bool begin();
    bool isVbusPresent();
    uint16_t vbusVoltageMv();
    ChargerState chargerState();
    bool enterChargeOnlyPowerState();
    void setChargeIndicator(ChargerState state);
    bool enableGps();
    bool disableGps();

    // Polls the GNSS receiver once. On a parsed fix returns true and writes
    // decimal-degrees latitude/longitude and meters altitude. On a failed
    // poll resets internal satellite counters to 0.
    bool pollFix(float &lat, float &lon, float &alt);

    // Polls the GNSS receiver once and fills a full LocationPayload,
    // including speed, satellite counts, accuracy, and timestamp.
    // Convenience wrapper around pollFix() + the +CGNSINF timestamp
    // fields; returns false (and zeroes the payload) on a failed poll.
    bool pollFixPayload(LocationPayload& out);

    // Raw `+CGNSINF` line for diagnostic visibility when pollFix() returns
    // false. First two fields after the prefix are run_status (1 = receiver
    // running) and fix_status (1 = locked). Empty string means the modem
    // did not respond within 10 s.
    // Copies the raw diagnostic response into a caller-owned buffer.
    size_t rawGnssState(char* buffer, size_t bufferSize);

    uint32_t satellitesUsed()   const { return _usat; }
    uint32_t satellitesInView() const { return _vsat; }

private:
    uint32_t _usat = 0;
    uint32_t _vsat = 0;
};

// Global accessor for the singleton XPowersPMU owned by gps_board.cpp.
// Lets other translation units (e.g. telemetry.cpp) drive the AXP2101
// (charging LED, rail telemetry) without exposing the instance globally.
XPowersPMU& board_pmu();
TinyGsm& board_modem();
