# Error context — LilyGo T-SIM7080G-S3 H606 no bootea el modem desde batería (botón PWR)

---

## 1. Objetivo del usuario

El usuario (Chamito) quiere demostrar que la **placa LilyGo T-SIM7080G-S3 H606** puede **encenderse
y operar completa desde la batería 18650**, sin necesidad de tener VBUS (USB-C 5 V) conectado.

Concretamente:

1. Cargar el firmware de producción `open-gps` en la placa.
2. Desconectar USB-C de la placa.
3. Pulsar el botón PWR (~200 ms, pulso corto).
4. La placa debe booteaut, el modem SIM7080G debe responder a comandos AT, y los LEDs rojos
   indicadores del modem deben encenderse (igual que con VBUS puesto).

Esto es la prueba clave para deployment en campo (asset tracking GPS vía LTE-M / NB-IoT).

## 2. Hardware

- **Placa**: LilyGo T-SIM7080G-S3 H606 (rev confirmable por `decision-0008-gps-tracker-iot-stack`
  en la vault Synapse).
- **MCU**: ESP32-S3 (Xtensa LX7 dual-core 240 MHz), 512 KB SRAM, 8 MB Octal SPI PSRAM.
  - **GPIO 35–37 NO disponibles** (PSRAM los usa).
  - **DC1 (ESP32-S3 core) NO ajustable** vía firmware — es el rail del SoC, brick si se toca.
- **Modem celular + GNSS**: SIMCom SIM7080G (LTE Cat-M + NB-IoT, sin 2G/3G/4G). UART1 (RX=4, TX=5).
  PWRKEY del modem en **GPIO 41**.
- **PMU**: X-Powers AXP2101 @ I2C address 0x34, en `Wire` (SDA=15, SCL=7). IRQ en GPIO 6.
- **Batería**: 18650 2800 mAh en holder onboard. Switch mecánico lateral (cerca del USB-C) hace
  corte duro `BAT ↔ VSYS`.
- **Botones / switches**:
  - Switch lateral (cerca USB-C): ON / OFF, corte duro.
  - Botón PWRKEY físico: pulsador momentáneo, conectado al pin `PWRKEY` del AXP2101.
    - **Pulso corto (~128 ms default)**: despierta al PMU del estado `RTC only`.
    - **Pulso largo (~6 s default, configurable vía `PMU.setPowerKeyPressOffTime`)**: ejecuta
      `PMU.shutdown()`.
  - Botón BOOT / RST en GPIO 0.
- **LEDs del modem (los relevantes para este bug)**:
  - **MODEM STATUS LED (rojo, cerca del SIM7080G)**: encendido fijo mientras el modem está vivo.
    NO controlable por el ESP32-S3 — está cableado internamente al modem.
  - **MODEM NETWORK STATE LED (rojo, cerca del SIM7080G)**: refleja estado de registro de red.
    Controlado por el SIM7080G, no por el ESP32-S3.
    - `64 ms on / 800 ms off` → no registrado en red.
    - `64 ms on / 3000 ms off` → registrado (PS domain registration successful).
    - `64 ms on / 300 ms off` → transmitiendo datos.
    - **Off** → modem apagado o en PSM sleep.
- **Otros LEDs**:
  - **BLUE LED (cerca del switch de batería)**: controlado por el AXP2101 (PMU). Modos posibles:
    `XPOWERS_CHG_LED_OFF`, `XPOWERS_CHG_LED_ON`, `XPOWERS_CHG_LED_BLINK_1HZ`,
    `XPOWERS_CHG_LED_BLINK_4HZ`, `XPOWERS_CHG_LED_CTRL_CHG` (default).
    En `CTRL_CHG` se comporta como: encendido mientras la batería está cargando, apagado cuando
    el PMU corta por terminación (target 4.1 V, Iterm < 25 mA).
- **No hay un RED LED onboard cableado a un GPIO del ESP32-S3** en la H606. Los dos LEDs rojos
  son del modem.

## 3. Firmware

### 3.1 Repo y paths

- **Repo firmware**: `/home/chamito/dev/open-gps/open-gps-iot/`
- **Entry point**: `src/main.cpp`
- **PMU + modem prologue**: `src/gps_board.cpp` (función `pmuInit()` y `modemPwrOn()`)
- **Pin definitions**: `include/utilities.h` (incluye `BOARD_MODEM_PWR_PIN (41)`,
  `BOARD_MODEM_RXD_PIN (4)`, `BOARD_MODEM_TXD_PIN (5)`, etc.)
- **PlatformIO config**: `platformio.ini`
  - `env:esp32s3box` con `board = esp32s3box`, `framework = arduino`.
  - `ARDUINO_USB_CDC_ON_BOOT=1` (USB CDC, no UART).
  - `TINY_GSM_MODEM_SIM7080`.
  - `monitor_speed = 115200`.

### 3.2 `src/main.cpp` (open-gps, estado actual — sin los cambios de debugging que probamos)

```cpp
#include <Arduino.h>
#include <esp_task_wdt.h>

#include "gps_board.h"
#include "location_payload.h"
#include "transport.h"
#include "config.h"
#include "secrets.h"

static GpsBoard board;
static Secrets  secrets;
static bool     wifi_up = false;

void setup() {
    Serial.begin(115200);
    delay(3000);  // Head-start delay for serial monitor re-enumeration
    Serial.println(F("\n[BOOT] T-SIM7080G-S3 GPS bring-up"));
    Serial.flush();

    esp_task_wdt_init(WATCHDOG_TIMEOUT_S, true);
    esp_task_wdt_add(NULL);

    if (!board.begin()) {
        Serial.println(F("[HALT] bring-up failed; rebooting in 5 s"));
        Serial.flush();
        delay(5000);
        ESP.restart();
    }
    Serial.flush();

    if (!secrets_load(secrets)) {
        Serial.println(F("[ERR ] secrets missing — copy config/secrets.example.h to config/secrets.h and fill uuid + api_key"));
        Serial.println(F("[HALT] rebooting in 5 s"));
        Serial.flush();
        delay(5000);
        ESP.restart();
    }
    secrets_print_diag(secrets);
    Serial.flush();

    wifi_up = transport_begin(secrets);
    Serial.flush();
}

void loop() {
    esp_task_wdt_reset();
    static unsigned long lastPoll = 0, lastIdle = 0, lastUpload = 0;
    static LocationPayload lastFix = {};
    static bool hasFix = false;
    const unsigned long now = millis();

    if (now - lastPoll >= FIX_POLL_MS) {
        lastPoll = now;
        if (board.pollFixPayload(lastFix)) {
            hasFix = true;
            Serial.printf("[FIX ] sats=%lu  lat=%.6f  lon=%.6f  alt=%.1fm\n", ...);
        } else if (now - lastIdle >= 10000) {
            lastIdle = now;
            String s = board.rawGnssState();
            ...
        }
    }

    if (!wifi_up || !hasFix) return;
    if (now - lastUpload < UPLOAD_PERIOD_S * 1000UL) return;
    lastUpload = now;

    if (transport_post_locations(lastFix, secrets)) {
        Serial.println(F("[UP  ] location sent"));
    } else {
        Serial.println(F("[ERR ] upload failed; next cycle will retry"));
    }
}
```

### 3.3 `src/gps_board.cpp` — el prologue crítico

```cpp
// ----- PMU prologue (de gps_board.cpp:31-56) -----
static bool pmuInit() {
    if (!PMU.begin(Wire, AXP2101_SLAVE_ADDRESS, I2C_SDA, I2C_SCL)) {
        Serial.println(F("[ERR] PMU begin failed"));
        return false;
    }
    Serial.println(F("[OK ] PMU online (AXP2101 @ 0x34)"));

    PMU.disableDC2(); PMU.disableDC4(); PMU.disableDC5();
    PMU.disableALDO1(); PMU.disableALDO2(); PMU.disableALDO3(); PMU.disableALDO4();
    PMU.disableBLDO2(); PMU.disableCPUSLDO(); PMU.disableDLDO1(); PMU.disableDLDO2();

    // Cold-boot only: force a clean DC3 cycle so the modem starts from off.
    if (esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_UNDEFINED) {
        PMU.disableDC3();
        delay(200);
    }

    PMU.setBLDO1Voltage(3300); PMU.enableBLDO1();  // ESP32 <-> modem UART level shifter
    PMU.setDC3Voltage(3000);   PMU.enableDC3();    // modem main rail (2700-3400 mV allowed)
    PMU.setBLDO2Voltage(3300); PMU.enableBLDO2();  // GPS antenna LNA power
    PMU.disableTSPinMeasure();

    Serial.println(F("[OK ] PMU rails up: BLDO1=3.3V (UART), DC3=3.0V (modem), BLDO2=3.3V (GPS ant)"));
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
    Serial.begin(115200);
    delay(300);
    Serial.println(F("\n[BOOT] T-SIM7080G-S3 GPS bring-up"));

    if (!pmuInit()) return false;

    Serial.println(F("[STEP] UART1 (RX=4, TX=5) @ 115200"));
    Serial1.begin(115200, SERIAL_8N1, BOARD_MODEM_RXD_PIN, BOARD_MODEM_TXD_PIN);

    Serial.println(F("[STEP] PWRKEY pulse"));
    modemPwrOn();

    Serial.println(F("[STEP] Waiting for modem AT (up to 15 s)"));
    int tries;
    for (tries = 1; tries <= 15; ++tries) {
        if (modem.testAT(1000)) break;
        Serial.printf("[... ] AT retry %d/15\n", tries);
    }
    if (tries > 15) {
        Serial.println(F("[ERR] modem did not respond to AT"));
        return false;
    }
    Serial.println(F("[OK ] modem AT responsive"));
    ...
}
```

## 4. Comportamiento observado

### 4.1 Con VBUS puesto (USB-C conectado a la placa)

**TODO funciona.** Log completo al conectar USB-C:

```
[BOOT] T-SIM7080G-S3 GPS bring-up
[OK ] PMU online (AXP2101 @ 0x34)
[OK ] PMU rails up: BLDO1=3.3V (UART), DC3=3.0V (modem), BLDO2=3.3V (GPS ant)
[STEP] UART1 (RX=4, TX=5) @ 115200
[STEP] PWRKEY pulse
[STEP] Waiting for modem AT (up to 15 s)
[... ] AT retry 1/15
[OK ] modem AT responsive
[STEP] Enabling GNSS receiver
[OK ] GNSS on; first fix may take minutes outdoors
[CFG ] uuid_len=36 key_len=43 uuid=5804360d-1c32-4bd0-9452-f0e00d93ac85 key_mask=rqKP...oD9M ssid_len=10 ssid=ColimaYork
[WIFI] connecting to ColimaYork ...
[OK  ] WiFi connected, IP=192.168.3.126 RSSI=-55 dBm
[STAT] 1,,,0.000000,0.000000,-18.000,,,1,,0.1,0.1,0.1,,,,9999000.0,6000.0
[STAT] 1,,,0.000000,0.000000,-18.000,,,1,,0.1,0.1,0.1,,,,9999000.0,6000.0
```

- Los **dos LEDs rojos del modem están prendidos**: uno fijo (MODEM STATUS), otro parpadeando
  ~1 s (MODEM NETWORK STATE, modo `64 ms on / 800 ms off` — modem no registrado en red todavía,
  pero vivo).
- WiFi conectado con IP `192.168.3.126`.
- GNSS prendido, esperando fix (los sentinels `0.000000` / `9999000.0` son el formato de "no fix").

### 4.2 Sin VBUS, solo batería, pulso PWR 200 ms (el caso que falla)

Procedimiento ejecutado:

1. Desconectar USB-C **de la placa** (no del PC).
2. Esperar 10 segundos.
3. Pulsar el botón PWR físico (NO el switch lateral) por ~200 ms (pulso corto, NO mantener 6 s).
4. Switch lateral en **ON** durante todo el procedimiento.
5. Esperar hasta 2 minutos sin tocar nada.

**Resultado observado:**

- Los LEDs rojos del modem **NO encienden** ni después de 2 minutos.
- El usuario no reportó telemetría por Serial (lógicamente, sin USB-C no hay CDC Serial — esto es
  esperable y no es la causa del problema).
- No pudimos verificar el estado del ESP32-S3 desde la última prueba (el heartbeat en GPIO2 que
  intentamos agregar fue revertido por no servir — GPIO2 no tiene un componente visible en esta
  variante de la H606).

### 4.3 Comparación con bench sketch (firmware de testing, distinto)

Hubo un **bench sketch** separado (`/home/chamito/dev/open-gps/open-gps-iot/src/main.cpp`
**anterior** o en otro path, NO es el open-gps actual) que:

- Deshabilitaba todos los rails del PMU (`disableDC2..5`, `disableALDO1..4`, etc.) **incluyendo
  `disableDC3` (modem rail)**.
- Configuraba `PMU.setChargingLedMode(XPOWERS_CHG_LED_BLINK_4HZ)` para hacer blink el BLUE LED
  del PMU a 4 Hz como indicador visual de "placa viva".

Con ese bench sketch + batería sola + PWR 200 ms, **el ESP32-S3 sí booteaba** y el BLUE LED
parpadeaba. Eso confirma que el AXP2101 despierta con PWRKEY y el ESP32 corre. El problema con
open-gps es **específico al modem no arrancando**, no al wakeup del ESP32-S3.

### 4.4 Otros datos

- **Batería**: 18650, medida recientemente con el bench sketch a `battery=4067mV` (cerca del
  target 4.1 V). Carga en curso a 400 mA. No es problema de batería descargada.
- **Watchdog**: `WATCHDOG_TIMEOUT_S = 30` (de `include/config.h:22`). `esp_task_wdt_init(30, true)`
  se llama en `setup()` antes de `board.begin()`. Si `board.begin()` tarda más de 30 s sin hacer
  `esp_task_wdt_reset()`, el watchdog reinicia la placa.
- **`delay(3000)` inicial** en `setup()` (línea 21). El watchdog se inicializa después (línea 25).
  Esto significa que durante los primeros 3 s del wakeup el watchdog NO está activo aún.

## 5. Hipótesis principales (para investigar)

### Hipótesis A — `disableDC3()` solo en cold boot

`gps_board.cpp:42-46`:

```cpp
if (esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_UNDEFINED) {
    PMU.disableDC3();
    delay(200);
}
```

Este código SOLO apaga `DC3` (modem rail) cuando el ESP32-S3 arranca desde un cold boot
(`ESP_SLEEP_WAKEUP_UNDEFINED`). Cuando la placa se despierta por `PMU.shutdown()` + PWRKEY,
`esp_sleep_get_wakeup_cause()` probablemente devuelve algo distinto, y `disableDC3()` no se
ejecuta — el modem queda en su estado anterior.

Si el modem se quedó en un estado raro (no apagado limpio) después del shutdown anterior,
`enableDC3()` lo prende pero `modem.testAT()` no responde porque el modem está en estado
intermedio.

**Fix candidato**: eliminar la condición `if` para que `disableDC3(); delay(200);` corra SIEMPRE
al inicio del prologue. ~3 líneas de cambio en `gps_board.cpp`.

### Hipótesis B — El watchdog se activa antes de que el modem bootee

`main.cpp:25` llama `esp_task_wdt_init(WATCHDOG_TIMEOUT_S, true)` con timeout 30 s. Si
`board.begin()` tarda más de 30 s en completarse (entre PMU prologue + UART1 begin + PWRKEY
pulse 1.1 s + hasta 15 s de AT retries + GNSS enable), el watchdog puede dispararse y resetear
la placa. Sin Serial visible (porque no hay USB-C), el síntoma es exactamente "los LEDs del
modem no encienden y nada pasa".

**Fix candidato**: feedear el watchdog durante `board.begin()` o aumentar el timeout.

### Hipótesis C — El modem necesita VBUS para el primer boot

El SIM7080G puede tener un perfil de energía donde la primera inicialización después de un
shutdown largo requiere VBUS presente (las corrientes de in-rush pueden saturar lo que la
batería provee sola en el instante del wakeup). Esto es un detalle del datasheet del SIM7080G.

**Fix candidato**: agregar un delay pre-PWRKEY para que el modem se estabilice con `DC3` ya
prendido pero sin transitorios.

### Hipótesis D — El `delay(3000)` inicial bloquea el watchdog setup

`main.cpp:21` llama `delay(3000)` ANTES de inicializar el watchdog (`main.cpp:25`). Durante
esos 3 s, si algo falla, la placa queda colgada sin watchdog que la rescate. Esto NO es la causa
del bug (no es "los LEDs no encienden después de 30 s"), pero podría enmascarar síntomas.

## 6. Pasos de diagnóstico recomendados

Si el lector de este documento quiere reproducir / verificar:

1. **Verificar firmware cargado**: con USB-C conectado y monitor serie abierto, leer la primera
   línea del log. Si dice `[BOOT] T-SIM7080G-S3 GPS bring-up` → open-gps. Si dice
   `[OK] Charge test ready` → bench sketch.

2. **Reproducir el bug**: con open-gps cargado, desconectar USB-C de la placa, esperar 10 s,
   pulsar PWR 200 ms, esperar 30 s, reconectar USB-C, leer monitor serie.

   **Resultados posibles**:
   - `[BOOT] ...` + `[OK ] modem AT responsive` → modem booteó, LEDs rojos se prenden, problema
     resuelto.
   - `[BOOT] ...` + `[ERR] modem did not respond to AT` → modem NO booteó, hipótesis A o C.
   - Nada en el monitor → ESP32-S3 no booteó, problema distinto de wakeup.

3. **Para distinguir A de C**: probar con un power bank (no VBUS del PC) en lugar de solo
   batería. Si con power bank el modem bootea y con batería sola no, es hipótesis C
   (in-rush). Si ninguno funciona, es hipótesis A (estado del modem).

## 7. Cambios intentados y revertidos

- **Cambio 1 (revertido)**: agregar `pinMode(2, OUTPUT); digitalWrite(2, HIGH);` al `setup()`
  de `open-gps-iot/src/main.cpp`. **Razón de la reversión**: GPIO2 no tiene un componente
  visible (LED, pista con LED, etc.) en esta variante de la H606. El heartbeat en GPIO2 quedó
  en HIGH pero el usuario no vio nada. El cambio fue revertido en `main.cpp:14-23` y el archivo
  está en su estado original.

- **Cambio 2 (revertido)**: agregar `PMU.setChargingLedMode(XPOWERS_CHG_LED_BLINK_4HZ)` en el
  bench sketch para usar el BLUE LED del PMU como heartbeat. Esto sí funcionó para confirmar
  que el ESP32-S3 bootea desde batería, pero es del bench sketch, NO del open-gps. open-gps no
  controla ningún LED.

- **Cambio 3 (intentado)**: probar GPIO1, luego GPIO2 como user LED. Ninguno tiene un
  componente visible en esta placa.

## 8. Recursos opcionales (vault Synapse)

Si el lector tiene acceso a la vault en `/home/chamito/dev/cerebro/`:

- `moc-gps-tracker` — hub del proyecto en la vault.
- `note-gps-tracker-iot.md` — hardware components.
- `note-lilygo-t-sim7080g-power.md` — PMU channels, charging, sleep modes.
- `note-lilygo-t-sim7080g-overview.md` — board identity, buttons, LEDs.
- `note-lilygo-t-sim7080g-pinout.md` — GPIO map.
- `decision-0008-gps-tracker-iot-stack.md` — stack decision.
- `journal-2026-08-06-gps-tracker-iot-power-bench.md` — journal del bench de carga de ayer
  (2026-08-06), donde el open question #1 era exactamente este test PWRKEY desde batería.

## 9. Resumen ejecutivo

**Bug**: la placa LilyGo T-SIM7080G-S3 H606 con firmware `open-gps` no bootea el modem SIM7080G
cuando se arranca desde batería sola (botón PWR 200 ms, sin VBUS). Con VBUS el modem bootea
normal en ~15–20 s. El ESP32-S3 sí arranca en ambos casos (confirmado con bench sketch).

**Sospechoso principal**: el código en `gps_board.cpp:42-46` que solo llama `disableDC3()` en
cold boot, no en wakeup por PWRKEY. Esto puede dejar al modem en un estado inconsistente.

**Fix más probable**: cambiar `if (esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_UNDEFINED)`
para que corra siempre (o para que cubra también `ESP_SLEEP_WAKEUP_EXT0` que es típico de un
GPIO wakeup).

**Cambio propuesto, conservador**:

```cpp
// Force a clean DC3 cycle on every boot so the modem starts from off,
// regardless of whether we woke from cold boot or PMU shutdown + PWRKEY.
PMU.disableDC3();
delay(200);
```

**Cambio propuesto, más conservador aún** (preservar lógica cold-boot, agregar wakeup-by-PWRKEY):

```cpp
esp_sleep_wakeup_cause_t cause = esp_sleep_get_wakeup_cause();
if (cause == ESP_SLEEP_WAKEUP_UNDEFINED || cause == ESP_SLEEP_WAKEUP_EXT0) {
    PMU.disableDC3();
    delay(200);
}
```

(Nota: el wakeup por `PMU.shutdown()` + PWRKEY probablemente se reporta como
`ESP_SLEEP_WAKEUP_EXT0` desde la perspectiva del ESP32-S3, porque el PWRKEY está conectado a un
GPIO wakeup source. Confirmar con experimentación si el EXT0 cubre este caso.)

**Próximo paso experimental recomendado**: aplicar el fix conservador (sin condición), reflashear,
repetir el procedimiento de la sección 6.2. Si `[OK ] modem AT responsive` aparece en el log
después del pulso PWR, el fix está validado.