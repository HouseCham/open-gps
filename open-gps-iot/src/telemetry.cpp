#include "telemetry.h"
#include "gps_board.h"
#include <XPowersLib.h>

static SystemState currentState = SystemState::BOOTING;
static bool stateInitialized = false;
static unsigned long lastBlinkMs = 0;
static uint8_t blinkStep = 0;
static bool successPulse = false;
static unsigned long successPulseUntil = 0;

static uint8_t patternBlinks() {
    switch (currentState) {
        case SystemState::WAITING_GNSS_FIX: return 2;
        case SystemState::GNSS_NO_RESPONSE: return 3;
        case SystemState::ERR_API_TRANSPORT: return 4;
        case SystemState::ERR_API_HTTP: return 5;
        case SystemState::ERR_BOARD: return 6;
        case SystemState::ERR_SECRETS: return 7;
        case SystemState::ERR_API_CONFIG: return 8;
        default: return 0;
    }
}

static void applyStateLed() {
    XPowersPMU& pmu = board_pmu();

    switch (currentState) {
        case SystemState::BOOTING:
            pmu.setChargingLedMode(XPOWERS_CHG_LED_ON);
            break;
        case SystemState::CONNECTING_NETWORK:
        case SystemState::UPLOADING_API:
            pmu.setChargingLedMode(XPOWERS_CHG_LED_BLINK_4HZ);
            break;
        case SystemState::ERR_NETWORK:
            pmu.setChargingLedMode(XPOWERS_CHG_LED_BLINK_1HZ);
            break;
        case SystemState::GNSS_FIX_READY:
            pmu.setChargingLedMode(XPOWERS_CHG_LED_ON);
            break;
        default:
            // Pattern states are advanced by telemetry_tick().
            pmu.setChargingLedMode(XPOWERS_CHG_LED_OFF);
            break;
    }
}

void telemetry_set_state(SystemState state) {
    if (stateInitialized && currentState == state) return;
    currentState = state;
    stateInitialized = true;
    blinkStep = 0;
    successPulse = false;
    applyStateLed();
}

void telemetry_pulse_success() {
    successPulse = true;
    successPulseUntil = millis() + 250;
    board_pmu().setChargingLedMode(XPOWERS_CHG_LED_ON);
}

void telemetry_tick() {
    const unsigned long now = millis();

    if (successPulse) {
        if ((long)(now - successPulseUntil) < 0) return;
        successPulse = false;
        applyStateLed();
    }

    const uint8_t targetBlinks = patternBlinks();
    if (targetBlinks == 0) {
        return;
    }

    const uint8_t sequenceLength = (targetBlinks * 2) + 6;

    if (now - lastBlinkMs < 150) return;
    lastBlinkMs = now;
    blinkStep++;

    XPowersPMU& pmu = board_pmu();

    if (blinkStep <= (targetBlinks * 2)) {
        pmu.setChargingLedMode((blinkStep % 2 != 0) ? XPOWERS_CHG_LED_ON : XPOWERS_CHG_LED_OFF);
    } else if (blinkStep >= sequenceLength) {
        blinkStep = 0;
    } else {
        pmu.setChargingLedMode(XPOWERS_CHG_LED_OFF);
    }
}
