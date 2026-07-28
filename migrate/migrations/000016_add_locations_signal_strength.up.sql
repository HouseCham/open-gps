-- Cellular signal strength (RSSI) from SIM7080G via AT+CSQ.
-- rssi: 0–31 (0 = -113 dBm, 31 = -51 dBm, 99 = not detectable).
-- Read once per cycle after cellular is on and before POST.
-- Decision: decision-gps-tracker-payload-esquema.

ALTER TABLE locations ADD COLUMN signal_strength integer NULL;
