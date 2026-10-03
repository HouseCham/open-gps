import type { DeviceVehicleType } from './devices.types';

export interface ReportFilter {
    from: string;
    to: string;
    timeZone: string;
    deviceIds: string[];
    vehicleType?: DeviceVehicleType;
}
export interface ReportDevice {
    id: string;
    name: string;
    vehicle_type: DeviceVehicleType;
}
export interface ReportMetadata {
    estimated: boolean;
    distance_unit: 'km';
    gap_threshold_seconds: number;
    poor_accuracy_threshold_meters: number;
    max_jump_speed_kph: number;
}
export interface ReportPoint {
    device_id: string;
    recorded_at: string;
    latitude: number;
    longitude: number;
    altitude?: number;
    speed?: number;
    accuracy?: number;
    battery_voltage?: number;
    signal_strength?: number;
}
export interface BucketCount {
    started_at: string;
    count: number;
}
export interface DeviceSummary {
    device: ReportDevice;
    point_count: number;
    estimated_distance_km: number;
    first_report: string | null;
    latest_report: string | null;
    longest_gap_seconds: number;
    jump_count: number;
}
export interface OverviewReport {
    device_count: number;
    point_count: number;
    estimated_distance_km: number;
    most_active_device?: ReportDevice;
    most_active_point_count: number;
    longest_gap_seconds: number;
    bucket_seconds: number;
    series: BucketCount[];
    devices: DeviceSummary[];
    metadata: ReportMetadata;
}
export interface RouteReport {
    device: ReportDevice;
    started_at: string;
    ended_at: string;
    duration_seconds: number;
    distance_km: number;
    average_speed_kph: number;
    maximum_speed_kph: number;
    complete_point_count: number;
    returned_point_count: number;
    jump_count: number;
    sampled: boolean;
    points: ReportPoint[];
}
export interface RoutesReport {
    routes: RouteReport[];
    metadata: ReportMetadata;
}
export interface TelemetryFloat {
    latest: number | null;
    minimum: number | null;
    maximum: number | null;
    average: number | null;
    present_count: number;
}
export interface TelemetryInt {
    latest: number | null;
    minimum: number | null;
    maximum: number | null;
    average: number | null;
    present_count: number;
}
export interface DeviceHealth {
    device: ReportDevice;
    latest_report: string | null;
    point_count: number;
    battery_voltage: TelemetryFloat;
    signal_strength: TelemetryInt;
    gps_accuracy: TelemetryFloat;
}
export interface HealthReport {
    devices: DeviceHealth[];
    metadata: ReportMetadata;
}
export interface OptionalPresence {
    altitude: number;
    speed: number;
    accuracy: number;
    battery_voltage: number;
    signal_strength: number;
}
export interface DeviceQuality {
    device: ReportDevice;
    point_count: number;
    gap_count: number;
    poor_accuracy_count: number;
    jump_count: number;
    interval_count: number;
    average_interval_seconds: number;
    longest_gap_seconds: number;
    optional_presence: OptionalPresence;
    first_report: string | null;
    latest_report: string | null;
}
export interface QualityReport {
    devices: DeviceQuality[];
    metadata: ReportMetadata;
}
