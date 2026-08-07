#include "telemetry.h"
#include "gps_board.h"
#include <XPowersLib.h>

static SystemState currentState = SystemState::BOOTING;
static unsigned long lastBlinkMs = 0;
static uint8_t blinkStep = 0;

void telemetry_set_state(SystemState state) {
    if (currentState == state) return;
    currentState = state;
    blinkStep = 0;

    XPowersPMU& pmu = board_pmu();

    switch (state) {
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
        case SystemState::WAITING_GNSS_FIX:
        default:
            pmu.setChargingLedMode(XPOWERS_CHG_LED_OFF);
            break;
    }
}

void telemetry_tick() {
    if (currentState != SystemState::ERR_SECRETS && currentState != SystemState::ERR_API_FAIL) {
        return;
    }

    const unsigned long now = millis();
    const uint8_t targetBlinks = (currentState == SystemState::ERR_SECRETS) ? 2 : 3;
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
