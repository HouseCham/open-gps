#pragma once

// LilyGo T-SIM7080G-S3 (H606) — ESP32-S3 + SIM7080G + AXP2101 PMU + GNSS.
// Pin map per LilyGo H606 schematic. Drop any LILYGO_*_CAM_PIR_VOICE
// branches — they target a different SKU (camera board) with no PMU.

#define LILYGO_ESP32S3_CAM_SIM7080G

// ----- I2C (AXP2101 PMU @ 0x34) -----
// Undef first: the esp32s3box variant defines I2C_SDA/SCL for its LCD bus;
// we need the board's actual PMU pins here.
#ifdef I2C_SDA
#undef I2C_SDA
#endif
#ifdef I2C_SCL
#undef I2C_SCL
#endif
#define I2C_SDA (15)
#define I2C_SCL (7)

#define PMU_INPUT_PIN (6)

// ----- Modem (SIM7080G over UART1) -----
#define BOARD_MODEM_PWR_PIN (41)   // PWRKEY — pull low >1s to power on
#define BOARD_MODEM_DTR_PIN (42)   // sleep/wake (unused in bring-up)
#define BOARD_MODEM_RI_PIN  (3)    // ring indicator (unused in bring-up)
#define BOARD_MODEM_RXD_PIN (4)    // ESP32 RX <- modem TX
#define BOARD_MODEM_TXD_PIN (5)    // ESP32 TX -> modem RX