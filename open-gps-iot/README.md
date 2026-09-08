# open-gps-iot

Firmware for a self-hosted GPS tracker built on the
[LilyGo T-SIM7080G-S3](https://github.com/Xinyuan-LilyGO/LilyGo-T-SIM7080G)
(ESP32-S3 + SIM7080G modem + AXP2101 PMU + integrated GNSS).

The device samples GPS fixes and POSTs them to a backend over HTTPS using the
configured cellular Cat-M/NB-IoT transport.

## Hardware

- **Board:** [LilyGo T-SIM7080G-S3 H606](https://github.com/Xinyuan-LilyGO/LilyGo-T-SIM7080G)
- **MCU:** ESP32-S3 (Xtensa LX7 dual-core, 240 MHz, 512 KB SRAM, 8 MB Octal PSRAM)
- **Modem:** SIMCom SIM7080G — LTE Cat-M + NB-IoT only (no 2G/3G/4G fallback)
- **GNSS:** SIM7080G integrated (GPS L1 + GLONASS + BeiDou + Galileo)
- **PMU:** X-Powers AXP2101 (14-channel DCDC/LDO)
- **Required antennas:** LTE IPEX MHF1 (included) + active GNSS IPEX MHF1

> The SIM7080G **cannot run GNSS and cellular simultaneously** — the radio is
> time-shared. For periodic sampling (e.g. once a minute) this is irrelevant;
> the WiFi path does not touch the cellular radio at all.

## Adaptive Sampling

GNSS polling and API reporting are separate decisions. While moving, the
firmware targets roughly 25 m between accepted points and selects
`clamp(25 m / speed_mps, 1 s, 15 s)`. Unknown motion starts with a 2 s poll;
stationary motion polls every 15 s and sends one heartbeat every 5 minutes.
For example, 5 m/s selects 5 s, while 130 km/h selects the 1 s lower bound,
which is approximately 36 m per fix. This is a sampling-density heuristic,
not a literal Nyquist guarantee for real GPS trajectories.

The SIM7080G time-shares GNSS and cellular operation. GNSS is disabled during
each cellular POST and re-enabled afterward, so actual fix and report spacing
can exceed the selected interval. Logs record this radio-off duration.
Tune the millisecond and metres/second constants in `include/config.h` only
after collecting hardware traces. Native policy tests run with `pio test -e
native`; real hardware validation is still required for walking, bicycle,
urban, highway, no-fix, and network-failure scenarios.

## USB-C Charge-Only Mode

When `CHARGE_MODE_ENABLED` is true, confirmed USB-C VBUS suspends tracking
regardless of battery level. PMU-only initialization runs first; modem rails,
UART/AT startup, GNSS, sampling, secrets, transport, and normal telemetry are
not started while charging. The AXP2101 continues charging and drives the
integrated LED: charging blinks at 1 Hz, PMU-reported charge completion is
steady on, and unknown/fault status blinks at 4 Hz. These LED mappings require
verification on the H606 hardware.

VBUS uses the AXP2101 digital input status and voltage measurement fallback,
with 4500/4000 mV hysteresis and a 2000 ms debounce. Removing VBUS from
charge-only mode causes one clean `ESP.restart()` into the normal tracker boot
path. Plugging in during normal operation requests the same reboot at the next
loop boundary. The PMU charger state, not battery voltage, defines completion.

Hardware testing has confirmed VBUS detection around 4.9 V with a battery
connected and no modem/network startup in charge-only mode. The integrated
blue LED was observed blinking while charging. Charge-complete steady-on
behavior, current measurements, rail shutdown measurements, and repeated
plug/unplug testing remain pending.

## Features

- PMU prologue with charge-only VBUS decision before tracker rails are enabled
- UART1 AT handshake with the modem (15 s timeout, retry loop)
- Adaptive GNSS polling from 1-15 s, targeting approximately 25 m between moving fixes
- Stationary location heartbeat every 5 minutes
- Hardware watchdog (`esp_task_wdt_init` 30 s)
- WiFi HTTPS POST (with single retry after 2 s)
- Secrets loaded from a git-ignored header, masked in boot logs
- Pure-data modules unit-tested on the host with Unity (no ESP32 toolchain needed)

> **TLS note:** the current build uses `setInsecure()` (cert validation
> bypassed) because the ESP32's clock is unset at boot and mbedtls rejects
> modern certs as not-yet-valid. Acceptable for dev/bench; **production
> builds must add NTP sync (`configTime()`)** and revert to `setCACert(NULL)`
> — see Design Decision #9 below.

## Repository layout

```
open-gps-iot/
├── platformio.ini              Build config (two envs: esp32s3box + native)
├── AGENTS.md                   Coding conventions and review rules
├── src/
│   ├── main.cpp                setup() + loop() — orchestrates, no logic
│   ├── gps_board.cpp           GpsBoard class — PMU + modem + GNSS bring-up
│   ├── transport.cpp           WiFi + HTTPS POST (HTTPClient over WiFiClientSecure)
│   ├── secrets.cpp             Secrets loader + masked diagnostic print
│   └── native_stub.cpp         1-line shim so PlatformIO native env has a TU
├── include/
│   ├── config.h                Global constants (API_HOST, FIX_POLL_MS, …)
│   ├── gps_board.h             GpsBoard public interface
│   ├── transport.h             Transport public interface (forwards Arduino-only types)
│   ├── secrets.h               Secrets struct + loader signatures
│   ├── secrets_data.h          Wrapper that #includes config/secrets.h
│   └── utilities.h             LilyGo pin definitions (UART, I2C, status LED)
├── lib/
│   ├── charge_mode/             Pure VBUS debounce policy
│   ├── location_payload/       Pure logic — JSON serialiser + GNSS → payload
│   │   ├── location_payload.h
│   │   └── location_payload.cpp
│   └── transport/              Pure logic — URL constructor (no Arduino deps)
│       ├── transport_url.h
│       └── transport_url.cpp
├── test/
│   ├── test_location_payload/  7 Unity tests for the JSON serialiser
│   ├── test_url_build/         5 Unity tests for transport_build_url()
│   └── test_charge_mode_policy/ VBUS hysteresis/debounce tests
├── scripts/
│   └── pre_build_secrets.py    SCons hook: forces rebuild when secrets.h changes
└── config/
    ├── secrets.example.h       Template — copy to secrets.h, fill in, never commit
    └── secrets.h               (gitignored) real device UUID + API key + WiFi creds
```

### Architectural split

| Module | Arduino deps? | Host-testable? | Responsibility |
|---|---|---|---|
| `src/main.cpp` | yes | no | thin orchestrator (setup + loop) |
| `src/gps_board.cpp` | yes | no | PMU / modem / GNSS hardware bring-up |
| `src/transport.cpp` | yes | no | WiFi init + HTTPS POST (one retry) |
| `src/secrets.cpp` | yes | no | loads `Secrets` struct from `config/secrets.h` |
| `lib/location_payload/` | **no** | **yes** | JSON serialisation, fix → payload |
| `lib/transport/` | **no** | **yes** | URL construction |
| `test/` | **no** | **yes** | Unity tests against the pure-data modules |

The `lib/` modules are deliberately free of `<Arduino.h>` so they can be compiled
under the native test environment with the host's C++ toolchain — fast feedback
loop, no flashing required.

## Build system

[PlatformIO](https://platformio.org/) is the only supported build path. Two
environments are defined in `platformio.ini`:

| Env | Target | Purpose |
|---|---|---|
| `esp32s3box` | ESP32-S3 on the T-SIM7080G | production firmware |
| `native` | developer machine (gcc) | unit tests against `lib/` modules |

### Key build flags (`esp32s3box`)

```
-DBOARD_HAS_PSRAM               # 8 MB Octal PSRAM is wired up
-DARDUINO_USB_CDC_ON_BOOT=1     # USB serial on the native USB port, not UART0
-DTINY_GSM_MODEM_SIM7080        # selects the SIM7080G driver in TinyGSM
-DTINY_GSM_RX_BUFFER=1024       # larger RX buffer for +CGNSINF lines
-I"${PROJECT_DIR}"              # so #include "config/secrets.h" resolves
```

### Library dependencies

- [TinyGSM](https://github.com/vshymanskyy/TinyGSM) — modem AT command layer
- [XPowersLib](https://github.com/lewisxhe/XPowersLib) — AXP2101 PMU driver
- [ArduinoJson](https://github.com/bblanchon/ArduinoJson) v7 — JSON serialisation

## Setup

### Prerequisites

- Python 3 + PlatformIO Core (`pip install platformio`)
- ESP32 toolchain (installed automatically by PlatformIO on first build)
- The board connected over USB-CDC

### First flash

```bash
# 1. Configure your device identity and WiFi credentials.
cp config/secrets.example.h config/secrets.h
# Edit config/secrets.h with your UUID, API key, and WiFi SSID/password.

# 2. Point the firmware at your backend.
#    Edit include/config.h and set API_HOST to your backend URL.

# 3. Build and flash.
pio run -e esp32s3box -t upload
```

`config/secrets.h` is git-ignored. Do not commit real credentials.

## Common commands

All commands assume your working directory is the repo root.

| Goal | Command |
|---|---|
| Compile (no flash) | `pio run -e esp32s3box` |
| Flash firmware | `pio run -e esp32s3box -t upload` |
| Serial monitor (115200 8N1) | `pio device monitor` |
| Clean build artefacts | `pio run -e esp32s3box -t clean` |
| Run all unit tests | `pio test -e native` |
| Build everything (envs + tests) | `make run && make test` |

> **Tip:** always pass `-e esp32s3box` explicitly on upload. Without it,
> PlatformIO runs the upload target in *every* env and the `native` env
> then fails trying to open the serial port.

## Testing

The pure-data modules (`lib/charge_mode`, `lib/location_payload`,
`lib/transport`) have host-side coverage under Unity:

```
test/test_location_payload/   7 tests
test/test_url_build/          5 tests
test/test_charge_mode_policy/ VBUS debounce tests
```

Run them with:

```bash
pio test -e native
```

Tests run on the host, no flashing required — typical run time is under 2 s.
Adding `-DUNITY_INCLUDE_DOUBLE` is required because the JSON serialiser
uses `double`-typed fields.

Hardware-in-the-loop testing (running tests on the actual ESP32) is not yet
wired up; verify new logic on real hardware before merging.

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
`if (payload['key'] != 0)`.

### 3. URL port `0` omits the `:port` suffix

`transport_build_url()` takes `api_port` as a `uint16_t`. If non-zero,
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

Pressing RST on the ESP32-S3 causes USB-CDC to re-enumerate; the serial
monitor loses the device for ~2 s. `delay(3000)` at the top of `setup()`
gives the host time to re-attach before any logs are emitted. Trade-off:
cold-boot is 3 s slower.

### 6. One retry on transport failure, then move on

The backend is idempotent (`ON CONFLICT DO NOTHING` on the locations table).
A failed POST is safe to retry on the next cycle — no client-side queue is
needed. The retry happens once after 2 s; if it also fails, the cycle moves
on and the next fix will be POSTed.

### 7. Watchdog fed from `loop()`

`esp_task_wdt_init(WATCHDOG_TIMEOUT_S, true)` arms a 30 s hardware watchdog.
`loop()` calls `esp_task_wdt_reset()` on every pass. If the loop stalls
(modem AT command hung, HTTPS connect blocked, etc.), the watchdog resets
the ESP32 and the bring-up runs again.

### 8. Pure-data modules live in `lib/`, not `src/`

Anything that doesn't need `<Arduino.h>` lives under `lib/` so the `native`
env can compile and test it on the host. Anything that touches hardware
lives in `src/` and is excluded from the test build via `build_src_filter`.

### 9. TLS currently uses `setInsecure()` — NTP sync is a Stage 4 task

The ESP32's `time(NULL)` is 0 at boot (~1970-01-01) and the firmware never
sets it. mbedtls checks every cert's `notBefore` against `time(NULL)` during
the TLS handshake, so any cert issued after 2024 gets rejected as "not yet
valid" with `MBEDTLS_ERR_X509_CERT_VERIFY_FAILED` (-1). `HTTPClient` collapses
that to `HTTPC_ERROR_CONNECTION_REFUSED` and the device logs
`HTTP transport failure (code=-1)`.

The diagnosis is one line: log `time(nullptr)` before the POST. `time=179`
≈ 1970-01-01 00:02:59 is the smoking gun.

**Current workaround (dev only):** `client.setInsecure()` in `src/transport.cpp`.
This bypasses cert validation entirely, which is fine for bench/iteration
against your own backend, but means anyone on the LAN can MITM the
connection and read the `X-Device-API-Key`.

**Production fix (Stage 4 task):** add `configTime()` with NTP servers
(`pool.ntp.org`, `time.nist.gov`, `time.cloudflare.com`) in `setup()`
after `WiFi.begin()` succeeds, wait for `time(nullptr) > 1700000000`,
then swap `setInsecure()` back to `setCACert(NULL)` (use the framework's
default CA bundle) or pin CloudFlare's root CA explicitly with
`setCACert(root_ca_pem)`.

**Generalization:** any TLS connection from a freshly-booted ESP32 fails
this way — HTTPS, MQTT over TLS, anything using mbedtls. Don't ship a
project that depends on `setInsecure()` in production.

## API contract

```
POST /api/v1/devices/<uuid_firmware>/locations
X-Device-API-Key: <32-byte base64url token>
Content-Type: application/json

{
  "recorded_at":    "2026-07-15T12:00:00Z",   // required, RFC 3339 UTC
  "latitude":        19.432608,                // required, double, 6 dp
  "longitude":      -99.133207,                // required, double, 6 dp
  "altitude":       2240.5,                    // optional, metres (omitted if unknown)
  "speed":            45.3,                    // optional, m/s    (omitted if unknown)
  "accuracy":          4.1,                    // optional, metres (omitted if unknown)
  "satellites_used":   9                      // optional, int    (omitted if unknown)
}
```

The device authenticates with a per-device API key (one active key per device,
rotation soft-deletes the prior key). The backend's locations table uses
`ON CONFLICT (device_id, recorded_at) DO NOTHING` — retries are safe.

## Roadmap

| Stage | Status | Description |
|---|---|---|
| 0 | done | Repo hygiene, config skeleton, watchdog |
| 1 | done | Secrets loader + masked diagnostic |
| 2 | done | `LocationPayload` — pure logic, 7 unit tests |
| 3 | done | WiFi HTTPS transport — 5 URL unit tests, hardware-verified |
| 4 | next | Sleep + cycle (`WiFi.mode(WIFI_OFF)` between uploads, optional deep sleep) + NTP time sync (`configTime()`) so `setInsecure()` can revert to `setCACert(NULL)` |
| 5 | planned | SIM7080G cellular swap (Cat-M/NB-IoT, Hologram APN) |
| 6 | planned | Battery voltage + cellular signal in the payload |

Hardware-verified: `WiFi connected`, `POST 201`, backend row inserted.

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
