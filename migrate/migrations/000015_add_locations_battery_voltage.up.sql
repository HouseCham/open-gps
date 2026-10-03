-- Battery voltage reported by the device (LiPo 3.7 V) via ESP32 internal ADC.
-- Read once per cycle before deep sleep. Decision: decision-gps-tracker-payload-esquema.

ALTER TABLE locations ADD COLUMN battery_voltage double precision NULL;
