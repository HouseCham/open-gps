# Decision Record: LilyGo T-SIM7080G-S3 H606 Battery-Only Boot Resolution

## Context
The LilyGo T-SIM7080G-S3 (H606) failed to boot when powered exclusively from the 18650 battery and initiated via the physical PWR button (200ms pulse). The device required VBUS (USB-C) presence to successfully boot the ESP32-S3 and initialize the SIM7080G modem. 

## Root Cause Analysis
1. **Pre-initialization Brownout:** The ESP32-S3 and SIM7080G experienced a severe transient in-rush current during the primary bootloader phase. Operating strictly from the battery, this current draw exceeded the immediate discharge capacity, resulting in a voltage sag. This sag triggered the ESP32-S3's hardware Brownout Detector (BOD), forcing the microcontroller into an infinite, silent reset loop before the AXP2101 PMU could be configured to manage and collapse the default power rails.
2. **Inconsistent Modem Power State:** The `DC3` rail (modem power) was only being explicitly disabled during a cold boot (`ESP_SLEEP_WAKEUP_UNDEFINED`). Wakeups via the PMU's PWR button left the modem in an unpredictable state.
3. **Boot Sequence Delays:** A blocking `delay(3000)` and Serial initializations were executed before configuring the PMU, unnecessarily extending the period where unmanaged rails drained the battery.

## Architecture Decisions & Implementation

### 1. Hardware BOD Masking (Mitigating In-rush Current)
**Decision:** Temporarily disable the hardware Brownout Detector immediately upon entering `setup()`.
**Rationale:** Allows the CPU to bypass the hardware reset triggered by the initial voltage sag and execute the PMU configuration payload.
**Security/Safety Implementation:** BOD is explicitly re-enabled (`WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 1)`) immediately after the PMU stabilizes the power topology to prevent non-volatile storage (NVS/Flash) corruption during genuine low-voltage events.

### 2. Immediate PMU Configuration
**Decision:** Refactor the boot sequence to execute `board.begin()` (and subsequently `pmuInit()`) as the absolute first instruction.
**Rationale:** Eliminates the unmanaged 3-second window where default hardware states exceed battery capacity. Serial initialization and delays are deferred until power rails are stable.

### 3. Unconditional Modem Rail Reset
**Decision:** Remove the `ESP_SLEEP_WAKEUP_UNDEFINED` condition for disabling the `DC3` rail in `pmuInit()`.
**Rationale:** Forces a clean power cycle for the modem on every boot (including PWR button wakeups), ensuring it starts from a known 'off' state before assertion of `PWRKEY`. A `delay(200)` ensures capacitance drain.

### 4. Rail Stabilization Delay
**Decision:** Introduce a 500ms blocking delay after enabling the `DC3` rail and before pulsing `PWRKEY`.
**Rationale:** Provides necessary time for the `DC3` voltage output to stabilize against the SIM7080G decoupling capacitors before the modem attempts its internal boot sequence.

### 5. Watchdog Timer (WDT) Maintenance
**Decision:** Inject `esp_task_wdt_reset()` within the AT command retry loop.
**Rationale:** The modem negotiation loop can block execution for up to 15 seconds. Feeding the hardware watchdog prevents an unhandled system panic during this standard initialization phase.
