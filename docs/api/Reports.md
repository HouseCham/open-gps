# Reports API Documentation

Base URL: `/api/v1`

The Reports API provides aggregate views over the location data belonging to
the authenticated user's active devices. All report endpoints use the same
filters and authorization model.

## Authentication and scope

All endpoints require an active session cookie (`authula.session_token`). The
dataset is limited to active devices for which the authenticated user has an
access grant. Deleted devices, deleted grants, and locations outside the
requested range are not included.

See [Authentication.md](./Authentication.md) for the session flow.

## Common query parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `from` | Yes | Local start time in `YYYY-MM-DDTHH:mm:ss` format. Inclusive at the API query boundary. |
| `to` | Yes | Local end time in `YYYY-MM-DDTHH:mm:ss` format. The database range is exclusive. |
| `time-zone` | Yes | IANA timezone, for example `America/Mexico_City`. `from` and `to` are converted to UTC before querying. |
| `device_ids` | No | Comma-separated device UUIDs. |
| `vehicle_type` | No | One of `bicycle`, `motorcycle`, `car`, `truck`, `van`, or `other`. |

The range must be positive and cannot exceed 31 days. The backend returns
`400 Bad Request` for missing or invalid parameters.

Example:

```
GET /api/v1/reports/overview?from=2026-08-17T12:00:00&to=2026-08-18T12:00:00&time-zone=America/Mexico_City&device_ids=550e8400-e29b-41d4-a716-446655440001&vehicle_type=car
Cookie: authula.session_token=...
```

## Response envelope

JSON endpoints return:

```json
{
  "status_code": 200,
  "message": "report overview retrieved",
  "data": {}
}
```

Every JSON report includes this metadata object:

```json
{
  "estimated": true,
  "distance_unit": "km",
  "gap_threshold_seconds": 300,
  "poor_accuracy_threshold_meters": 50,
  "max_jump_speed_kph": 200
}
```

Distances are estimated with the Haversine formula. Segments that imply a
speed above `200 km/h` are counted as jumps and excluded from distance.
Nullable telemetry values are returned as `null`, not as zero.

---

## GET /api/v1/reports/overview

Returns totals, a time series, and a summary for every selected device.

**Success message:** `report overview retrieved`

**Response `200 OK`:**

```json
{
  "status_code": 200,
  "message": "report overview retrieved",
  "data": {
    "device_count": 1,
    "point_count": 240,
    "estimated_distance_km": 86.42,
    "most_active_device": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Delivery Van",
      "vehicle_type": "van"
    },
    "most_active_point_count": 240,
    "longest_gap_seconds": 480,
    "bucket_seconds": 3600,
    "series": [
      { "started_at": "2026-08-17T18:00:00Z", "count": 120 }
    ],
    "devices": [
      {
        "device": {
          "id": "550e8400-e29b-41d4-a716-446655440001",
          "name": "Delivery Van",
          "vehicle_type": "van"
        },
        "point_count": 240,
        "estimated_distance_km": 86.42,
        "first_report": "2026-08-17T18:00:00Z",
        "latest_report": "2026-08-18T11:59:30Z",
        "longest_gap_seconds": 480,
        "jump_count": 1
      }
    ],
    "metadata": { "estimated": true, "distance_unit": "km", "gap_threshold_seconds": 300, "poor_accuracy_threshold_meters": 50, "max_jump_speed_kph": 200 }
  }
}
```

`bucket_seconds` is selected from the requested range: 15 minutes for ranges
up to 6 hours, 1 hour up to 24 hours, 6 hours up to 7 days, and 24 hours for
longer ranges. If no device has points, `most_active_device` is `null` and
its point count is `0`.

---

## GET /api/v1/reports/routes

Builds routes from consecutive points. A gap greater than 5 minutes starts a
new route, and routes with fewer than 2 points are omitted. Calculations use
all points, but the returned geometry is limited to 1,000 evenly distributed
points while preserving the first and last point.

**Success message:** `report routes retrieved`

**Response `200 OK`:**

```json
{
  "status_code": 200,
  "message": "report routes retrieved",
  "data": {
    "routes": [
      {
        "device": { "id": "550e8400-e29b-41d4-a716-446655440001", "name": "Delivery Van", "vehicle_type": "van" },
        "started_at": "2026-08-17T18:00:00Z",
        "ended_at": "2026-08-17T20:30:00Z",
        "duration_seconds": 9000,
        "distance_km": 32.1,
        "average_speed_kph": 12.8,
        "maximum_speed_kph": 54.2,
        "complete_point_count": 450,
        "returned_point_count": 450,
        "jump_count": 0,
        "sampled": false,
        "points": [
          {
            "device_id": "550e8400-e29b-41d4-a716-446655440001",
            "recorded_at": "2026-08-17T18:00:00Z",
            "latitude": 19.432608,
            "longitude": -99.133207,
            "altitude": 2240.5,
            "speed": 12.4,
            "accuracy": 4.1,
            "battery_voltage": 3.72,
            "signal_strength": 23
          }
        ]
      }
    ],
    "metadata": { "estimated": true, "distance_unit": "km", "gap_threshold_seconds": 300, "poor_accuracy_threshold_meters": 50, "max_jump_speed_kph": 200 }
  }
}
```

`sampled` is `true` when `returned_point_count` is less than
`complete_point_count`. An empty range returns `routes: []`.

---

## GET /api/v1/reports/health

Returns telemetry statistics for each selected device. Statistics only use
values that were present in the original location reports.

**Success message:** `report health retrieved`

**Response `200 OK`:**

```json
{
  "status_code": 200,
  "message": "report health retrieved",
  "data": {
    "devices": [
      {
        "device": { "id": "550e8400-e29b-41d4-a716-446655440001", "name": "Delivery Van", "vehicle_type": "van" },
        "latest_report": "2026-08-18T11:59:30Z",
        "point_count": 240,
        "battery_voltage": { "latest": 3.72, "minimum": 3.55, "maximum": 4.1, "average": 3.81, "present_count": 230 },
        "signal_strength": { "latest": 23, "minimum": 12, "maximum": 31, "average": 22.4, "present_count": 220 },
        "gps_accuracy": { "latest": 4.1, "minimum": 2.3, "maximum": 58.0, "average": 8.7, "present_count": 240 }
      }
    ],
    "metadata": { "estimated": true, "distance_unit": "km", "gap_threshold_seconds": 300, "poor_accuracy_threshold_meters": 50, "max_jump_speed_kph": 200 }
  }
}
```

For a device with no points, `latest_report` is `null`, `point_count` is `0`,
and all telemetry statistics contain `null` values with `present_count: 0`.

---

## GET /api/v1/reports/data-quality

Reports regularity, gaps, suspicious jumps, accuracy problems, and optional
telemetry completeness per device.

**Success message:** `report data quality retrieved`

**Response `200 OK`:**

```json
{
  "status_code": 200,
  "message": "report data quality retrieved",
  "data": {
    "devices": [
      {
        "device": { "id": "550e8400-e29b-41d4-a716-446655440001", "name": "Delivery Van", "vehicle_type": "van" },
        "point_count": 240,
        "gap_count": 3,
        "poor_accuracy_count": 4,
        "jump_count": 1,
        "interval_count": 239,
        "average_interval_seconds": 30,
        "longest_gap_seconds": 480,
        "optional_presence": {
          "Altitude": 220,
          "Speed": 240,
          "Accuracy": 240,
          "BatteryVoltage": 230,
          "SignalStrength": 220
        },
        "first_report": "2026-08-17T18:00:00Z",
        "latest_report": "2026-08-18T11:59:30Z"
      }
    ],
    "metadata": { "estimated": true, "distance_unit": "km", "gap_threshold_seconds": 300, "poor_accuracy_threshold_meters": 50, "max_jump_speed_kph": 200 }
  }
}
```

`gap_count` counts intervals greater than 5 minutes. `poor_accuracy_count`
counts accuracy values strictly greater than 50 meters. `optional_presence`
contains the number of points where each optional field was present. The JSON
property names are currently `Altitude`, `Speed`, `Accuracy`,
`BatteryVoltage`, and `SignalStrength`.

---

## GET /api/v1/reports/export

Exports the filtered location points in chronological order.

**Required query parameter:** `format=csv` or `format=gpx`, in addition to
the common report parameters.

### CSV

```
GET /api/v1/reports/export?from=2026-08-17T12:00:00&to=2026-08-18T12:00:00&time-zone=America/Mexico_City&format=csv
```

Response `200 OK` has:

```http
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename=report.csv
```

The columns are:

```text
timestamp,device_id,latitude,longitude,speed_mps,altitude_m,accuracy_m,battery_voltage_v,signal_strength_csq
```

### GPX

```
GET /api/v1/reports/export?from=2026-08-17T12:00:00&to=2026-08-18T12:00:00&time-zone=America/Mexico_City&format=gpx
```

Response `200 OK` has:

```http
Content-Type: application/gpx+xml; charset=utf-8
Content-Disposition: attachment; filename=report.gpx
```

The body is a GPX 1.1 track. Each point is a `<trkpt>` with latitude,
longitude, and timestamp; altitude is included as `<ele>` when available.

Exports are limited to 100,000 points. More than that returns `400 Bad
Request` with `report export exceeds the maximum point limit`.

## Common error responses

| Status Code | Message | Meaning |
|-------------|---------|---------|
| 400 | `from, to, and time-zone are required` | One or more required range parameters are missing |
| 400 | `invalid time-zone` | `time-zone` is not a valid IANA timezone |
| 400 | `invalid from` / `invalid to` | The value is not `YYYY-MM-DDTHH:mm:ss` |
| 400 | `from must be before to` | The range is empty or reversed |
| 400 | `report range cannot exceed 31 days` | The requested range is too large |
| 400 | `invalid device id` | A value in `device_ids` is not a UUID |
| 400 | `invalid vehicle_type` | The vehicle type is not supported |
| 400 | `format must be csv or gpx` | Export format is missing or unsupported |
| 400 | `report export exceeds the maximum point limit` | Export contains more than 100,000 points |
| 401 | `unauthorized` | Session cookie is missing or expired |
| 403 | `must change password` | User must change the password before using application routes |

Database or unexpected service failures use the API's standard error handler
and are not represented as successful report responses.
