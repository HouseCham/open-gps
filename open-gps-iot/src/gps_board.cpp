#include "gps_board.h"
#include <Arduino.h>
#include <esp_sleep.h>
#include "utilities.h"
#define XPOWERS_CHIP_AXP2101
#include "XPowersLib.h"
#include <TinyGsmClient.h>
#include <esp_task_wdt.h>

static XPowersPMU PMU;

#ifdef DUMP_AT_COMMANDS
#include <StreamDebugger.h>
static StreamDebugger s_modemDbg(Serial1, Serial);
static TinyGsm modem(s_modemDbg);  // every modem byte echoed to USB-CDC
#else
static TinyGsm modem(Serial1);
#endif

// Debug-mode logging per project request: every important action (setup
// step, AT handshake, GNSS enable, fix / no-fix) prints a tagged line.
// Named LOG (not DBG) to avoid colliding with TinyGSM's internal DBG macro.
#define LOG(msg) do { Serial.print(F(msg "\n")); } while (0)

// ----- PMU prologue --------------------------------------------------------
// Canonical sequence from ATDebug.ino:36-95. Disable unused rails for low
// quiescent draw, then raise the three rails the modem path needs.
static bool pmuInit() {
    if (!PMU.begin(Wire, AXP2101_SLAVE_ADDRESS, I2C_SDA, I2C_SCL)) {
        return false;
    }

    // Rationale: Explicitly disable all non-essential rails immediately.
    PMU.disableDC2(); PMU.disableDC4(); PMU.disableDC5();
    PMU.disableALDO1(); PMU.disableALDO2(); PMU.disableALDO3(); PMU.disableALDO4();
    PMU.disableBLDO2(); PMU.disableCPUSLDO(); PMU.disableDLDO1(); PMU.disableDLDO2();

    // Rationale: Force a clean state for the modem rail on every boot cycle.
    PMU.disableDC3();
    
    // Rationale: Wait for capacitance to drain.
    delay(200);

    PMU.setBLDO1Voltage(3300); PMU.enableBLDO1();
    PMU.setDC3Voltage(3000);   PMU.enableDC3();
    PMU.setBLDO2Voltage(3300); PMU.enableBLDO2();
    PMU.disableTSPinMeasure();

    // Rationale: Stabilize DC3 output voltage before attempting modem communication.
    delay(500);

    // Rationale: Visual heartbeat indicating ESP32 successfully bypassed BOD.
    PMU.setChargingLedMode(XPOWERS_CHG_LED_BLINK_4HZ);

    return true;
}

// PWRKEY pulse per ATDebug.ino:99-114: LOW 100ms, HIGH 1000ms, LOW.
static void modemPwrOn() {
    pinMode(BOARD_MODEM_PWR_PIN, OUTPUT);
    digitalWrite(BOARD_MODEM_PWR_PIN, LOW);  delay(100);
    digitalWrite(BOARD_MODEM_PWR_PIN, HIGH); delay(1000);
    digitalWrite(BOARD_MODEM_PWR_PIN, LOW);
}

bool GpsBoard::begin() {
    if (!pmuInit()) {
        return false;
    }

    Serial1.begin(115200, SERIAL_8N1, BOARD_MODEM_RXD_PIN, BOARD_MODEM_TXD_PIN);
    modemPwrOn();

    int tries = 1;
    bool is_modem_responsive = false;
    
    for (tries = 1; tries <= 15; ++tries) {
        if (modem.testAT(1000)) {
            is_modem_responsive = true;
            break;
        }
    }
    
    if (!is_modem_responsive) {
        return false;
    }

    modem.enableGPS();

    return true;
}

bool GpsBoard::pollFix(float &lat, float &lon, float &alt) {
    float spd = 0.0f, acc = 0.0f;
    int vsat = 0, usat = 0;
    int yy = 0, mo = 0, dd = 0, hh = 0, mi = 0, ss = 0;

    if (!modem.getGPS(&lat, &lon, &spd, &alt,
                      &vsat, &usat, &acc,
                      &yy, &mo, &dd, &hh, &mi, &ss)) {
        _vsat = 0;
        _usat = 0;
        return false;
    }
    _vsat = static_cast<uint32_t>(vsat);
    _usat = static_cast<uint32_t>(usat);
    return true;
}

String GpsBoard::rawGnssState() {
    return modem.getGPSraw();
}

bool GpsBoard::pollFixPayload(LocationPayload& out) {
    // Zero the payload first so a failed poll leaves it cleanly empty
    // (no stale lat/lon from a previous fix leaking through).
    memset(&out, 0, sizeof(out));

    float lat = 0, lon = 0, spd = 0, alt = 0, acc = 0;
    int   vsat = 0, usat = 0;
    int   yy = 0, mo = 0, dd = 0, hh = 0, mi = 0, ss = 0;

    if (!modem.getGPS(&lat, &lon, &spd, &alt,
                      &vsat, &usat, &acc,
                      &yy, &mo, &dd, &hh, &mi, &ss)) {
        _vsat = 0;
        _usat = 0;
        return false;
    }
    _vsat = static_cast<uint32_t>(vsat);
    _usat = static_cast<uint32_t>(usat);

    location_payload_from_fix(out,
        lat, lon, spd, alt, usat, acc,
        yy, mo, dd, hh, mi, ss);
    return true;
}
