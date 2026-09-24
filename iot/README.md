# open-gps-iot

Firmware for a self-hosted GPS tracker built on the
[LilyGo T-SIM7080G-S3](https://github.com/Xinyuan-LilyGO/LilyGo-T-SIM7080G)
(ESP32-S3 + SIM7080G modem + AXP2101 PMU + integrated GNSS).

The device samples GPS fixes, queues them in a persistent LittleFS ring, and
drains the queue in idempotent batches over LTE Cat-M/NB-IoT (Hologram APN).
The legacy WiFi transport was removed; cellular is the only path.

## Hardware

- **Board:** [LilyGo T-SIM7080G-S3 H606](https://github.com/Xinyuan-LilyGO/LilyGo-T-SIM7080G)
- **MCU:** ESP32-S3 (Xtensa LX7 dual-core, 240 MHz, 512 KB SRAM, 8 MB Octal PSRAM)
- **Modem:** SIMCom SIM7080G — LTE Cat-M + NB-IoT only (no 2G/3G/4G fallback)
- **GNSS:** SIM7080G integrated (GPS L1 + GLONASS + BeiDou + Galileo)
- **PMU:** X-Powers AXP2101 (14-channel DCDC/LDO)
- **Storage:** LittleFS on the flash `spiffs` partition (896 KB in `huge_app.csv`)
- **Required antennas:** LTE IPEX MHF1 (included) + active GNSS IPEX MHF1
- **Console pins:** GPIO43 (U0TXD/TXD) and GPIO44 (U0RXD/RXD) on the pin
  header — UART0, used for serial logs in the production build

> The SIM7080G **cannot run GNSS and cellular simultaneously** — the radio is
> time-shared. The firmware disables GNSS for the duration of each cellular
> POST and re-enables it afterwards; the log line `[RADIO] GNSS off <ms>`
> records the actual off-time.

> GPIO35–37 are reserved by the Octal SPI PSRAM and must not be reassigned.

## Development vs production builds

Two firmware environments target the same board; they differ in **where the
serial console goes** and **whether charge-only mode exists**:

| | `esp32s3box-debug` (dev) | `esp32s3box` (production) |
|---|---|---|
| Serial console | Native USB CDC → `/dev/ttyACM0` | UART0 on GPIO43/44 → USB-TTL adapter |
| `ARDUINO_USB_CDC_ON_BOOT` | `1` | `0` (CDC can block battery-only boot) |
| `WAIT_FOR_SERIAL` | `1` (waits up to 5 s for the host) | not set |
| `CHARGE_MODE_ENABLED` | **false** — tracks while plugged in | **true** — VBUS suspends tracking |
| Use it for | bench development, watching logs over USB-C | flashing devices, field/HIL testing |

`WAIT_FOR_SERIAL` disables charge-only mode on purpose (see
`include/config.h`): if the dev build entered charge-only whenever USB was
connected, the console you need for development would never print anything.

Flash each with:

```bash
pio run -e esp32s3box-debug -t upload   # dev: USB console, charge mode OFF
pio run -e esp32s3box -t upload          # production: charge mode ON, TTL console
```

After flashing production, `/dev/ttyACM0` going silent is the expected
confirmation that the production image (CDC off) is running.

## Serial console and TTL wiring (production)

Production logs go to UART0 (GPIO43/44), not the USB-C port. To watch them,
wire a 3.3 V USB-TTL adapter (CH340 / CP2102) to the pin header:

```
USB-TTL adapter          T-SIM7080G-S3 header
  RX  ───────────────────  GPIO43 / TXD   (board transmit)
  TX  ───────────────────  GPIO44 / RXD   (board receive)
  GND ───────────────────  GND
```

- Do **not** connect the adapter's VCC/5V — the board is powered via USB-C.
- Keep the TTL attached during tests; the USB-C cable is the one you
  plug/unplug (it carries VBUS, which charge-only mode reacts to).
- Monitor: `pio device monitor -b 115200 -p /dev/ttyUSB0` (the adapter's
  port; `/dev/ttyACM0` is the board's native USB and stays mute in
  production).

## USB-C charge-only mode

When `CHARGE_MODE_ENABLED` is true, a confirmed USB-C VBUS suspends tracking
regardless of battery level. Boot order: PMU-only initialization → watchdog →
VBUS debounce → charge-only loop. Modem rails, UART/AT startup, GNSS,
sampling, secrets, transport, and telemetry are never started while charging.
The AXP2101 keeps charging and drives the integrated LED: charging blinks at
1 Hz, PMU-reported charge completion is steady on, and unknown/fault status
blinks at 4 Hz.

VBUS uses the AXP2101 digital input status with a voltage-measurement
fallback, 4500/4000 mV hysteresis, and a 2000 ms debounce polled every 1 s.
Rail shutdown (`enterChargeOnlyPowerState()`) disables the modem (DC3),
UART (BLDO1), and GNSS (BLDO2) rails; the PMU and its I2C stay alive so VBUS
monitoring keeps working.

Log sequence (all lines flushed before any restart):

| Log | When |
|---|---|
| `[CHARGE] entering charge-only mode; waiting for VBUS removal` | boot with VBUS confirmed |
| `[CHARGE] VBUS detected; restarting into charge-only` | VBUS appears during normal tracking (one `ESP.restart()`) |
| `[CHARGE] VBUS removed; restarting tracker` | VBUS removed in charge-only (one `ESP.restart()`) |
| `[ERR] charge-only rail shutdown failed; restarting` | PMU rail failure — restarts and retries (known failure loop if the PMU is dead) |

Production reaches `runChargeOnlyMode()` *before* `setup()`'s own
`Serial.begin()` (which happens only on the tracker path), so
`runChargeOnlyMode()` brings UART0 up itself — otherwise none of these logs
would exist on a production image.

Hardware testing so far: VBUS detection around 4.9 V with battery connected,
no modem/network startup in charge-only, blue LED blinking while charging.
The full acceptance sequence (charge-only entry ×3–5 boots, unplug → exactly
one restart → tracker, hot-plug → exactly one restart → charge-only) is the
Phase 3.6b HIL run and is pending; charge-complete steady-on behavior and
rail-shutdown current measurements are also pending.

## Adaptive sampling

GNSS polling and API reporting are separate decisions. While moving, the
firmware targets roughly 25 m between accepted points and selects
`clamp(25 m / speed_mps, 1 s, 15 s)`. Unknown motion starts with a 2 s poll;
stationary motion polls every 15 s and sends one heartbeat every 5 minutes
(`UploadReason::STATIONARY_HEARTBEAT`, reason code 4). For example, 5 m/s
selects 5 s, while 130 km/h selects the 1 s lower bound, which is
approximately 36 m per fix. This is a sampling-density heuristic, not a
literal Nyquist guarantee for real GPS trajectories.

Motion state uses hysteresis (enter ≥ 1.5 m/s, exit ≤ 0.8 m/s) with a
3-fix confirmation count before switching states.

### Fix quality gates

Applied only when the field is known (0 = unknown skips the gate). A rejected
fix logs `[REJECT] fix failed validation` and does not update motion/upload
state:

| Gate | Value (`include/config.h`) | Rejects |
|---|---|---|
| Max age | `MAX_FIX_AGE_MS = 30000` | same GNSS timestamp longer than 30 s (stale fix) |
| Accuracy | `MAX_ACCURACY_M = 50` | known accuracy above 50 m |
| Satellites | `MIN_SATELLITES = 4` | known `satellites_used` below 4 |
| Implied speed | `MAX_SPEED_MPS = 500` | glitch/teleport guard vs the previous accepted fix (≈1800 km/h, not a vehicle limit) |
| Year sanity | recorded_at year `0000` | invalid GNSS date |

Upload reasons: `0 NONE`, `1 FIRST_VALID_FIX`, `2 DISTANCE_REACHED`,
`3 INTERVAL_ELAPSED`, `4 STATIONARY_HEARTBEAT`.

Tune the constants in `include/config.h` only after collecting hardware
traces. Native policy tests run with `pio test -e native`; real hardware
validation is still required for walking, bicycle, urban, highway, no-fix,
and network-failure scenarios.

## Radio open policy (when the modem may transmit)

The modem is not opened per fix. `radioDue()` (pure, `lib/sampling_policy`)
allows a drain when the queue is non-empty **and** any of:

- queue has ≥ `UPLOAD_BATCH_MIN_ITEMS` (20) items — queue-full gate, or
- the radio has never opened since boot — first delivery, or
- flush interval elapsed since last open: `UPLOAD_FLUSH_MS_MOVING` (30 s) or
  `UPLOAD_FLUSH_MS_STATIONARY` (60 s).

Each drain peeks up to `BATCH_MAX_ITEMS` (20) records, disables GNSS for the
upload window, POSTs, re-enables GNSS, and logs the off-time. Backlog
accumulated during an outage flushes through the same gate.

## Persistent fix queue

Accepted fixes are enqueued **before** any network attempt, so a coverage gap
never loses a point (Phase 2 of `audit-fix-plan.md`).

- `lib/fix_queue/` — pure ring-buffer logic: fixed 64-byte `FixRecord`
  (scaled integers, no float ABI dependency), CRC-16 versioned encode/decode.
- `src/persistent_fix_store.cpp` — LittleFS adapter: data file `/fixq.data`
  (2048 slots × 64 B = 128 KB) plus A/B meta files `/fixq.a`, `/fixq.b`
  (generation counter + CRC) — after a power cut the newer valid meta wins.
- `sequence_id` starts at 1 and increments per record; `boot_id` is random
  per boot (queue-internal only, not sent to the API).
- Full queue drops the oldest record and increments `lost_count`
  (`[QUEUE] size=… lost=…` log).
- `peek()` reads without removing; `ackFront(n)` advances only after HTTP 201.
- A corrupt record at the front resets the queue (preferred over a skip/ack
  heuristic).

### Batch upload

- `POST /api/v1/devices/<uuid>/locations/batch` with up to 20 items
  (`dto.MaxBatchItems`). The firmware drains in **sub-batches of 3**
  (`SUB_BATCH_ITEMS`) because the SIM7080G's third `+CASEND` on one TLS
  connection always fails (HIL: write stalls at 790 bytes). Each
  sub-batch ≈ one header + body shot ≤ ~900 B.
- Items carry `sequence_id`; the backend responds 201 with
  `accepted_sequence_ids[]` and `rejected[{sequence_id, code, retryable}]`.
  HTTP 201 means every item was accepted *or permanently rejected* — safe to
  ack the whole peeked prefix. Mid-loop failure re-sends unacked front on the
  next drain; the backend is idempotent by `(device_id, recorded_at)` and by
  `sequence_id`.
- Missing battery/signal fields are enriched at enqueue time and again live
  (AT+CSQ + PMU voltage) right before the POST, because GNSS is off during
  upload.
- One retry per sub-batch POST on transport failure: 2 s backoff → network
  check → PDP reconnect → second attempt → give up (points stay queued).

## Cellular connectivity and recovery

- `transportCellularBegin()` runs once at boot: `CFUN=0` → LTE-M RAT
  preference → APN via `+CGDCONT`/`+CNCFG` → PDP attach (Hologram).
- `CellularManager` (`src/cellular_manager.cpp`) wraps the pure
  `lib/connectivity_policy` state machine
  (`IDLE → READY → BACKOFF → RECONNECT_PDP → RESTART_MODEM → FAILED`).
  Backoff starts at `CELLULAR_RECOVERY_BASE_MS` (30 s), caps at
  `CELLULAR_RECOVERY_MAX_MS` (15 min), max 6 attempts.
- GNSS keeps sampling while the network is down — fixes queue locally and
  flush when connectivity returns.

## Power management (Phase 3.5 — actuators off)

- `lib/power_manager/` maps a `PowerProfile`
  (`MOVING / STATIONARY / NO_NETWORK / LOW_BATTERY / CHARGING`) to allowed
  actions; `main.cpp` logs `[PWR] profile=… dtr=… deep=… psm=… up=…` on
  every profile change.
- All actuators ship **disabled** behind compile-time flags in
  `include/config.h`: `POWER_MODEM_DTR`, `POWER_DEEP_SLEEP`, `POWER_PSM_EDRX`
  are `false`. Enabling order when the time comes: DTR → deep sleep →
  PSM/eDRX (the last needs Hologram-granted timers + a 10/10 HIL wake test).
- **VBAT sag proxy (3.4):** the AXP2101 has no current ADC, so the firmware
  samples battery voltage at 1 Hz per `SystemState` and reports
  `[VBAT] rest=… n= min= avg= max= sag=` every 30 s, plus explicit samples
  across the upload window (the 1 Hz sampler never sees `UPLOADING_API`
  because the POST blocks the loop). This ranks load between states; it does
  **not** capture ms-scale TX peaks and cannot produce absolute mA — that
  needs a PPK2/Joulescope.
- **Low-battery hysteresis (3.6a):** `LOW_BATTERY_ENTER_MV = 3400`,
  `LOW_BATTERY_EXIT_MV = 3600`, logs `[BATT]` on transition; 0 mV readings
  (PMU not ready) are ignored. No action is taken yet — the profile only
  changes the log line.

## Telemetry and watchdog

- `src/telemetry.cpp` drives the status LED from a `SystemState` machine
  (BOOTING, CONNECTING_NETWORK, WAITING_GNSS_FIX, GNSS_FIX_READY,
  GNSS_NO_RESPONSE, UPLOADING_API, ERR_*), with a success pulse on each acked
  batch.
- 30 s task watchdog (`WATCHDOG_TIMEOUT_S`) armed in `setup()` and fed on
  every `loop()` pass (and the charge-only loop).
- `WdtDetachGuard` (`include/wdt_guard.h`) detaches the watchdog only around
  calls that legitimately block past 30 s (TLS handshake/write, PDP attach) —
  `readHttpResponse()` re-arms resets inside its own wait loops.

## Features

- PMU-first boot: charge-only VBUS decision before tracker rails enable
- Persistent fix queue (LittleFS ring, 2048 × 64 B, CRC + A/B meta recovery)
- Idempotent batch upload (≤ 20 items, sub-batch 3, ack by `sequence_id`)
- Adaptive GNSS polling 1–15 s targeting ~25 m between moving fixes
- Fix quality gates (age/accuracy/satellites/teleport guard) with `[REJECT]`
- Motion state machine with hysteresis + confirmation count
- Radio open policy (queue-full / first-open / motion-dependent flush)
- Cellular recovery FSM with capped backoff (30 s → 15 min, 6 attempts)
- USB-C charge-only mode with LED status (production build only)
- VBAT sag proxy per state + low-battery hysteresis
- Power profiles with actuators disabled behind flags (Phase 3.5)
- Hardware watchdog + detach guard for long cellular stalls
- Secrets loaded from a git-ignored header, masked in boot logs
- Pure-data modules unit-tested on the host with Unity (74 tests, no ESP32
  toolchain needed)

> **TLS:** the cellular path uses `TinyGsmClientSecure` — TLS terminates in
> the SIM7080G, and TinyGSM 0.12.0 configures the modem TLS context
> internally. CA/SNI provisioning is a modem-firmware deployment
> requirement. The old WiFi `setInsecure()` workaround was removed together
> with the WiFi transport in Phase 2.

## Repository layout

```
open-gps-iot/
├── platformio.ini              Build config (3 envs: esp32s3box, esp32s3box-debug, native)
├── Makefile                    make test | make esp32 | make debug
├── AGENTS.md                   Coding conventions and review rules
├── audit-fix-plan.md           Phased reliability plan (source of the roadmap below)
├── src/
│   ├── main.cpp                setup() + loop() — orchestrates, no logic
│   ├── gps_board.cpp           GpsBoard class — PMU + modem + GNSS bring-up
│   ├── transport.cpp           Cellular HTTPS POST (TinyGsmClientSecure)
│   ├── cellular_manager.cpp    Drives the connectivity recovery FSM
│   ├── telemetry.cpp           LED state machine + success pulse
│   ├── persistent_fix_store.cpp LittleFS adapter for the fix queue
│   ├── secrets.cpp             Secrets loader + masked diagnostic print
│   └── native_stub.cpp         1-line shim so PlatformIO native env has a TU
├── include/
│   ├── config.h                All tunable constants (sampling, radio, power, queue)
│   ├── gps_board.h             GpsBoard public interface
│   ├── transport.h             Transport interface + TransportResult
│   ├── cellular_manager.h      CellularManager interface
│   ├── telemetry.h             SystemState enum + telemetry API
│   ├── persistent_fix_store.h  FixStore interface
│   ├── wdt_guard.h             WdtDetachGuard RAII helper
│   ├── secrets.h               Secrets struct + loader signatures
│   ├── secrets_data.h          Wrapper that #includes config/secrets.h
│   └── utilities.h             LilyGo pin definitions (UART, I2C, status LED)
├── lib/                        Pure-data modules (no <Arduino.h>, host-testable)
│   ├── battery_policy/         Low-battery enter/exit hysteresis
│   ├── charge_mode/            VBUS debounce policy
│   ├── connectivity_policy/    Cellular recovery state machine
│   ├── fix_queue/              FixRecord + ring meta (CRC, A/B recovery)
│   ├── location_payload/       JSON serialiser + GNSS → payload conversions
│   ├── power_manager/          PowerProfile → allowed actions
│   ├── sampling_policy/        Motion, quality gates, upload reasons, radioDue()
│   ├── transport/              URL constructors (single + batch)
│   └── vbat_sag/               Per-state VBAT min/avg/max/sag tracker
├── test/                       10 Unity suites (74 tests, `pio test -e native`)
│   ├── test_batch_payload/     Batch JSON + ACK parsing
│   ├── test_battery_policy/    Low-battery hysteresis
│   ├── test_charge_mode_policy/ VBUS hysteresis/debounce
│   ├── test_connectivity_policy/ Recovery FSM transitions
│   ├── test_fix_queue/         Ring + record encode/decode + meta recovery
│   ├── test_location_payload/  Single-payload JSON
│   ├── test_power_manager/     Profile decisions with flags off/on
│   ├── test_sampling_policy/   Motion, gates, reasons, radioDue()
│   ├── test_url_build/         transportBuildUrl + batch URL
│   └── test_vbat_sag/          Sag tracker maths
├── scripts/
│   └── pre_build_secrets.py    SCons hook: forces rebuild when secrets.h changes
└── config/
    ├── secrets.example.h       Template — copy to secrets.h, fill in, never commit
    └── secrets.h               (gitignored) real device UUID + API key + APN
```

### Architectural split

| Module | Arduino deps? | Host-testable? | Responsibility |
|---|---|---|---|
| `src/main.cpp` | yes | no | thin orchestrator (setup + loop) |
| `src/gps_board.cpp` | yes | no | PMU / modem / GNSS hardware bring-up |
| `src/transport.cpp` | yes | no | Cellular HTTPS POST (one retry per sub-batch) |
| `src/cellular_manager.cpp` | yes | no | Recovery FSM driver |
| `src/telemetry.cpp` | yes | no | LED state machine |
| `src/persistent_fix_store.cpp` | yes | no | LittleFS persistence for the queue |
| `src/secrets.cpp` | yes | no | loads `Secrets` from `config/secrets.h` |
| `lib/sampling_policy/` | **no** | **yes** | Motion, quality gates, upload reasons, radio gate |
| `lib/fix_queue/` | **no** | **yes** | 64 B records, ring meta, CRC |
| `lib/location_payload/` | **no** | **yes** | JSON serialisation (single + batch) |
| `lib/transport/` | **no** | **yes** | URL construction |
| `lib/charge_mode/` | **no** | **yes** | VBUS debounce/hysteresis |
| `lib/connectivity_policy/` | **no** | **yes** | Cellular recovery FSM |
| `lib/power_manager/` | **no** | **yes** | Profile → allowed actions |
| `lib/battery_policy/` | **no** | **yes** | Low-battery hysteresis |
| `lib/vbat_sag/` | **no** | **yes** | VBAT sag statistics |
| `test/` | **no** | **yes** | Unity tests against the pure-data modules |

The `lib/` modules are deliberately free of `<Arduino.h>` so they compile
under the native test environment with the host's C++ toolchain — fast
feedback loop, no flashing required.

## Build system

[PlatformIO](https://platformio.org/) is the only supported build path. Three
environments are defined in `platformio.ini`:

| Env | Target | Purpose |
|---|---|---|
| `esp32s3box` | ESP32-S3 on the T-SIM7080G | production firmware (TTL console, charge mode ON) |
| `esp32s3box-debug` | same board | dev firmware (USB CDC console, charge mode OFF) |
| `native` | developer machine (gcc) | unit tests against `lib/` modules |

### Key build flags (`esp32s3box`, production)

```
-DBOARD_HAS_PSRAM               # 8 MB Octal PSRAM is wired up
-DARDUINO_USB_CDC_ON_BOOT=0     # console on UART0 (GPIO43/44), not USB —
                                # native USB CDC can block battery-only boot
-DTINY_GSM_MODEM_SIM7080        # selects the SIM7080G driver in TinyGSM
-DTINY_GSM_RX_BUFFER=1024       # larger RX buffer for +CGNSINF lines
-I"${PROJECT_DIR}"              # so #include "config/secrets.h" resolves
```

`esp32s3box-debug` inherits these, unflags `CDC_ON_BOOT=0`, and adds
`-DARDUINO_USB_CDC_ON_BOOT=1 -DWAIT_FOR_SERIAL=1`.

### Library dependencies

- [TinyGSM](https://github.com/vshymanskyy/TinyGSM) — modem AT command layer + TLS client
- [XPowersLib](https://github.com/lewisxhe/XPowersLib) — AXP2101 PMU driver
- [ArduinoJson](https://github.com/bblanchon/ArduinoJson) v7 — JSON serialisation

## Setup

### Prerequisites

- Python 3 + PlatformIO Core (`pip install platformio`)
- ESP32 toolchain (installed automatically by PlatformIO on first build)
- USB-C cable for flashing (both envs)
- Optional: 3.3 V USB-TTL adapter to read the production console (see
  [Serial console and TTL wiring](#serial-console-and-ttl-wiring-production))

### First flash

```bash
# 1. Configure your device identity and cellular credentials.
cp config/secrets.example.h config/secrets.h
# Edit config/secrets.h: DEVICE_UUID_FIRMWARE, DEVICE_API_KEY,
# API_HOST, CELLULAR_APN.

# 2. Build and flash. Start with the debug env to watch logs over USB:
pio run -e esp32s3box-debug -t upload
pio device monitor -b 115200

# 3. For production/field images (charge mode ON, TTL console):
pio run -e esp32s3box -t upload
```

`config/secrets.h` is git-ignored. Do not commit real credentials.
The `WIFI_SSID` / `WIFI_PASSWORD` fields in the template are legacy leftovers
from the removed WiFi transport — unused, may be left empty.

## Common commands

All commands assume your working directory is the repo root.

| Goal | Command |
|---|---|
| Compile production (no flash) | `pio run -e esp32s3box` |
| Compile debug (no flash) | `pio run -e esp32s3box-debug` |
| Flash production | `pio run -e esp32s3box -t upload` |
| Flash dev | `pio run -e esp32s3box-debug -t upload` |
| Monitor dev console (USB) | `pio device monitor -e esp32s3box-debug` → `/dev/ttyACM0` |
| Monitor production console (TTL) | `pio device monitor -b 115200 -p /dev/ttyUSB0` |
| Run all unit tests | `pio test -e native` |
| Clean build artefacts | `pio run -e esp32s3box -t clean` |
| Shortcuts | `make test` / `make esp32` / `make debug` |

> **Tip:** always pass `-e <env>` explicitly on upload. Without it,
> PlatformIO runs the upload target in *every* env and the `native` env
> then fails trying to open the serial port.

## Testing

The pure-data modules have host-side coverage under Unity — 74 tests across
10 suites (`pio test -e native`, typical run under 10 s, no flashing):

| Suite | Covers |
|---|---|
| `test_sampling_policy` | Motion hysteresis, quality gates, upload reasons, `radioDue()` |
| `test_fix_queue` | 64 B record encode/decode, ring meta CRC, A/B recovery, loss policy |
| `test_batch_payload` | Batch JSON shape + `accepted_sequence_ids`/`rejected` parsing |
| `test_location_payload` | Single-payload JSON, optional-field omission, conversions |
| `test_power_manager` | Profile decisions with all flags off/on |
| `test_battery_policy` | 3400/3600 mV enter/exit hysteresis |
| `test_vbat_sag` | Per-state min/avg/max/sag maths |
| `test_connectivity_policy` | Recovery FSM transitions and backoff |
| `test_url_build` | Single + batch URL construction |
| `test_charge_mode_policy` | VBUS hysteresis + debounce |

Tests run on the host; `-DUNITY_INCLUDE_DOUBLE` is set because the JSON
serialiser uses `double`-typed fields.

Hardware-in-the-loop test procedures (VBUS sequence, queue power-cut
persistence, backlog drain) are tracked in `audit-fix-plan.md` — always
verify new logic on real hardware before merging.

## Key design decisions

These are the non-obvious choices that informed the code. Keep them in mind
when modifying or extending.

### 1. `double`, not `float`, for coordinates

ArduinoJson v7 hardcodes 6 decimal places for `float` and 9 for `double`.
GPS coordinates like `19.432608` lose precision when serialised as float.
`double` uses the ESP32's 32-bit float hardware — same range, but the
serialiser keeps the full 6 dp. Roughly 1 mm of GPS precision preserved.

### 2. `0` is the "unknown" sentinel for optional fields

The API contract treats absent fields as "unknown". Sending `0` for altitude
would mean "0 m above sea level", which is a lie. So:

- `location_payload_from_fix()` writes `0` for any optional field the modem
  did not provide.
- `location_payload_to_json()` *omits* the JSON key entirely when the value
  is `0`.

This means backend consumers must check `if ('key' in payload)`, not
`if (payload['key'] != 0)`. Battery voltage and signal strength follow the
same rule (`0` omitted; signal also omits `-1` as the internal "not
measured" marker).

### 3. URL port `0` omits the `:port` suffix

`transportBuildUrl()` takes `api_port` as a `uint16_t`. If non-zero,
the result is `<host>:<port>/api/v1/...`; if zero, just `<host>/api/v1/...`.
Useful when `API_HOST` already includes the port or scheme (e.g.
`https://api.example.com`).

### 4. Pre-build hook for secrets

PlatformIO's SCons dep tracker only watches files inside `src/`, `include/`,
`lib/`, and `test/`. `config/secrets.h` is *outside* that graph, so changing
it would produce a stale binary until a manual `pio run -t clean`.

`scripts/pre_build_secrets.py` runs as a `pre:` extra-script and touches
`src/secrets.cpp` when `config/secrets.h` is newer, forcing a recompile.

### 5. 3 s head-start delay in `setup()`

Pressing RST causes USB-CDC to re-enumerate; the serial monitor loses the
device for ~2 s (relevant mainly for the debug env, where CDC is on).
`SETUP_HEADSTART_DELAY_MS` at the top of `setup()` gives the host time to
re-attach before any logs are emitted. Trade-off: cold-boot is 3 s slower.

### 6. One retry per POST, then keep the points queued

A failed POST is never lost: points live in the persistent queue until a 201
comes back. Transport failures retry once after a 2 s backoff plus a PDP
reconnect attempt; if that also fails, the drain ends and the next
`radioDue()` window tries again. The backend is idempotent
(`ON CONFLICT DO NOTHING` on `(device_id, recorded_at)` and by
`sequence_id`), so re-sends after a crash or partial ack are safe.

### 7. Watchdog fed from loop, detached only around known-long calls

`esp_task_wdt_init(WATCHDOG_TIMEOUT_S, true)` arms a 30 s hardware watchdog.
`loop()` (and the charge-only loop) call `esp_task_wdt_reset()` every pass.
Calls that legitimately exceed 30 s over LTE-M — TLS handshake/write, PDP
attach — run under `WdtDetachGuard`, and `readHttpResponse()` re-arms resets
inside its byte-wait loops so a hung read still trips the watchdog.

### 8. Pure-data modules live in `lib/`, not `src/`

Anything that doesn't need `<Arduino.h>` lives under `lib/` so the `native`
env can compile and test it on the host. Anything that touches hardware
lives in `src/` and is excluded from the test build via `build_src_filter`.

### 9. TLS terminates in the modem, not the ESP32

The cellular path uses `TinyGsmClientSecure`; the SIM7080G owns the TLS
handshake and TinyGSM 0.12.0 configures its context. The ESP32 never sees
certificates or the system clock problem that plagues `WiFiClientSecure`
(fresh-boot `time(NULL)` = 1970 rejects modern certs). CA/SNI provisioning
is therefore a **modem-firmware deployment requirement**, not firmware code.
The old `setInsecure()` WiFi workaround was deleted with the WiFi transport
in Phase 2 — do not reintroduce it.

### 10. Charge-only mode owns its own `Serial.begin()`

`setup()` decides charge-only *before* its own `Serial.begin()` (which sits
late in the tracker path, after rails stabilize). If charge-only didn't
bring UART0 up itself, every `[CHARGE]` log — entry, rail failure, VBUS
removal — would be silently lost on a production image. That ordering is
load-bearing: moving `Serial.begin` earlier in `setup()` would work too, but
then tracker-path logs would race the rail-stabilization window.

### 11. The radio opens on a schedule, not per fix

Opening LTE-M costs more energy than the fix itself. `radioDue()` gates every
drain on queue-full / first-open / motion-dependent flush intervals instead
of uploading on each accepted point. Keep new network activity behind that
gate — an uncatalogued per-fix POST would silently undo Phase 3.3.

### 12. Power actuators ship disabled behind flags

`POWER_MODEM_DTR`, `POWER_DEEP_SLEEP`, and `POWER_PSM_EDRX` all default to
`false`; `PowerManager` computes the *decision* but `main.cpp` applies
nothing until its HIL gate passes (DTR first, deep sleep next, PSM/eDRX last
— PSM needs Hologram-granted timers plus a 10/10 wake test). Do not flip a
flag without its measurement data; the whole point of the split is that
unproven power-saving cannot brick a field device.

### 13. Persistent queue with fixed-width records

`FixRecord` is 64 bytes of scaled integers (`latitude_e6`, `speed_mmps`, …)
so the on-flash layout does not depend on float ABI, and every record is
CRC-checked on read. Persistence is LittleFS with A/B meta files and a
generation counter — a power cut mid-write leaves one valid meta to recover
from. Ack-on-201 (`ackFront`) is deliberately the only deletion path: the
device never drops a point on enqueue failure or HTTP confusion, only on
queue overflow (drop-oldest) or confirmed send.

## API contract

Firmware-facing ingestion (full request/response reference in
[`../docs/api/Locations.md`](../docs/api/Locations.md) for the single-item
endpoint; the batch route is registered in the backend router):

```
POST /api/v1/devices/<uuid_firmware>/locations/batch
X-Device-API-Key: <device API key>
Content-Type: application/json

{"items":[
  {
    "recorded_at":      "2026-07-15T12:00:00Z",  // required, RFC 3339 UTC
    "latitude":          19.432608,               // required, ±90
    "longitude":        -99.133207,               // required, ±180
    "altitude":        2240.5,                    // optional, m       (omitted if unknown)
    "speed":             45.3,                    // optional, m/s     (omitted if unknown)
    "accuracy":           4.1,                    // optional, m       (omitted if unknown)
    "satellites_used":    9,                      // optional, int     (omitted if unknown)
    "battery_voltage":  3.91,                     // optional, 0..6 V  (omitted if unknown)
    "signal_strength":   18,                      // optional, 0..31   (AT+CSQ, omitted if unknown)
    "sequence_id":       42                       // queue id, idempotency key
  }, ...                    // ≤ 20 items per request (≤ 3 per HTTP shot from firmware)
]}
```

Response (HTTP 201):

```
{"accepted_sequence_ids":[41,42], "rejected":[{"sequence_id":43,"code":"...","retryable":false}]}
```

A 201 means every item was accepted *or permanently rejected* — the firmware
then acks the whole peeked prefix. Authentication is the per-device API key
(`X-Device-API-Key`, one active key per device; rotation soft-deletes the
prior key).

## Roadmap (audit-fix-plan)

Live plan: [`audit-fix-plan.md`](./audit-fix-plan.md).

| Phase | Status | Scope |
|---|---|---|
| 0 | done | Baseline + product decisions |
| 1 | done | Cellular recovery + diagnostics (HIL closed) |
| 2 | done | Persistent queue + batch upload (HIL closed: power-cut survival, 33-item drain, no duplicates) |
| 3 | mostly done | Sampling correction + power optimization — 3.1–3.6a shipped and HIL-verified (session 6); **3.6b HIL VBUS sequence pending**; Phase 3.5 actuator flags stay off until Hologram timers + wake HIL; absolute mA needs a PPK2/Joulescope |
| 4 | pending | Production security & delivery docs: Secure Boot / Flash Encryption / OTA evaluation, modem+antenna parameter record, key-rotation procedure |

Known accepted limitations: VBAT sag at 1 Hz misses ms-scale TX peaks; a
dead PMU in charge-only mode restarts into the same mode (hardware failure,
not a logic bug); `trycloudflare.com` tunnels sleep on cold start (infra, not
firmware).

## Contributing

See [`AGENTS.md`](./AGENTS.md) for the binding coding standards — the
highlights:

- No Arduino `String` in `loop()` or ISRs; use fixed `char[]` buffers.
- Watchdog fed on any long-running or network-dependent loop.
- Secrets live in the git-ignored `config/secrets.h`, never committed.
- One class per peripheral/responsibility; `setup()` / `loop()` orchestrate,
  they don't implement.
- New pure-data modules go in `lib/` so they can be unit-tested on the host.

## License

See project root for license terms.
