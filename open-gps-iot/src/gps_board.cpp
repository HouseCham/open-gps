#include "gps_board.h"
#include <Arduino.h>
#include <esp_sleep.h>
#include "utilities.h"
#define XPOWERS_CHIP_AXP2101
#include "XPowersLib.h"
#include <TinyGsmClient.h>
#include <esp_task_wdt.h>

static XPowersPMU PMU;

XPowersPMU& board_pmu() { return PMU; }

static TinyGsm modem(Serial1);

#ifdef WAIT_FOR_SERIAL
#define BOARD_PRINTF(...) Serial.printf(__VA_ARGS__)
#else
#define BOARD_PRINTF(...) do { } while (0)
#endif

static void logLine(const char* tag, const char* message) {
    BOARD_PRINTF("[%8lu][%-5s] %s\n", millis(), tag, message);
}

// ----- PMU prologue --------------------------------------------------------
// Canonical sequence from ATDebug.ino:36-95. Disable unused rails for low
// quiescent draw, then raise the three rails the modem path needs.
static bool pmuInit() {
    logLine("PMU", "initializing AXP2101 over I2C");
    if (!PMU.begin(Wire, AXP2101_SLAVE_ADDRESS, I2C_SDA, I2C_SCL)) {
        logLine("ERR", "AXP2101 init failed");
        return false;
    }
    logLine("PMU", "AXP2101 online; enabling diagnostic LED");

    // Earliest visible heartbeat: if this never lights on battery, the ESP32
    // did not complete PMU I2C initialization or the PMU LED path is unpowered.
    PMU.setChargingLedMode(XPOWERS_CHG_LED_ON);

    // Rationale: Explicitly disable all non-essential rails immediately.
    PMU.disableDC2(); PMU.disableDC4(); PMU.disableDC5();
    PMU.disableALDO1(); PMU.disableALDO2(); PMU.disableALDO3(); PMU.disableALDO4();
    PMU.disableBLDO2(); PMU.disableCPUSLDO(); PMU.disableDLDO1(); PMU.disableDLDO2();

    // BLDO1 powers the modem UART level conversion. Keep it alive across resets.
    // Only remove DC3 on a true power cycle; cycling it on every ESP restart can
    // leave the modem and the ESP32 out of sync.
    if (esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_UNDEFINED) {
        PMU.disableDC3();
        delay(200);
    }

    PMU.setBLDO1Voltage(3300); PMU.enableBLDO1();
    PMU.setDC3Voltage(3000);   PMU.enableDC3();
    PMU.setBLDO2Voltage(3300); PMU.enableBLDO2();
    PMU.disableTSPinMeasure();

    PMU.enableBattDetection();
    PMU.enableBattVoltageMeasure();
    PMU.enableVbusVoltageMeasure();
    BOARD_PRINTF("[%8lu][PMU  ] rails enabled: BLDO1, DC3, BLDO2; battery=%umV vbus=%umV\n",
                 millis(),
                 (unsigned)PMU.getBattVoltage(),
                 (unsigned)PMU.getVbusVoltage());

    // H606 modem rail needs time to settle before PWRKEY is toggled.
    delay(3000);

    return true;
}

// H606 recovery pulse: LOW 100ms, HIGH 1500ms, LOW.
static void modemPwrOn() {
    logLine("MODEM", "pulsing PWRKEY");
    pinMode(BOARD_MODEM_PWR_PIN, OUTPUT);
    digitalWrite(BOARD_MODEM_PWR_PIN, LOW);  delay(100);
    digitalWrite(BOARD_MODEM_PWR_PIN, HIGH); delay(1500);
    digitalWrite(BOARD_MODEM_PWR_PIN, LOW);
    delay(2000);
}

bool GpsBoard::begin() {
    logLine("BOARD", "PMU init");
    if (!pmuInit()) {
        return false;
    }

    logLine("MODEM", "starting UART1 at 115200");
    Serial1.begin(115200, SERIAL_8N1, BOARD_MODEM_RXD_PIN, BOARD_MODEM_TXD_PIN);
    pinMode(BOARD_MODEM_PWR_PIN, OUTPUT);
    pinMode(BOARD_MODEM_DTR_PIN, OUTPUT);
    digitalWrite(BOARD_MODEM_DTR_PIN, LOW);
    logLine("MODEM", "DTR forced awake");

    // Some H606/AXP2101 revisions start the modem as soon as DC3 is enabled;
    // pulsing PWRKEY unconditionally can then turn that already-running modem off.
    // Probe first, matching LilyGO's ATDebug example, and only pulse PWRKEY after
    // repeated failures.
    int tries = 1;
    bool is_modem_responsive = false;
    
    for (tries = 1; tries <= 30; ++tries) {
        BOARD_PRINTF("[%8lu][MODEM] AT probe %d/30\n", millis(), tries);
        if (modem.testAT(1000)) {
            is_modem_responsive = true;
            break;
        }
        if (tries == 10 || tries == 20) {
            logLine("MODEM", "AT silent; sending delayed PWRKEY start pulse");
            modemPwrOn();
        }
        esp_task_wdt_reset();
    }
    
    if (!is_modem_responsive) {
        logLine("ERR", "modem did not respond to AT");
        return false;
    }
    logLine("MODEM", "AT responsive");

    logLine("GNSS", "enabling GNSS receiver");
    if (!modem.enableGPS()) {
        logLine("ERR", "GNSS enable command failed");
        return false;
    }
    logLine("GNSS", "receiver enabled; waiting for outdoor fix");

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
