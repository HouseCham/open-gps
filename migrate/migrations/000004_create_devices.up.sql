-- IoT devices. Hardware identifier: uuid_firmware (public, generated in the ESP32).
-- Authentication: combined with the device_api_keys table (X-Device-Key header).

CREATE TABLE devices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_firmware  varchar(36) NOT NULL UNIQUE,
  name           varchar(255) NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT NOW(),
  last_seen_at   timestamptz NULL,
  deleted_at     timestamptz NULL
);

-- Hot auth path: backend looks up the device by uuid_firmware on every IoT request.
CREATE INDEX idx_devices_active_uuid
  ON devices (uuid_firmware) WHERE deleted_at IS NULL;
