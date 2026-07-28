import type { DeviceVehicleType } from '@/types/api';
import {
    Bike,
    Car,
    Motorbike,
    Package,
    Truck,
    Van,
    type LucideIcon,
} from 'lucide-react';

/**
 * @constant VEHICLE_TYPE_OPTIONS
 * @description The ordered list of selectable vehicle types.
 */
export const VEHICLE_TYPE_OPTIONS = [
    'bicycle',
    'motorcycle',
    'car',
    'truck',
    'van',
    'other',
] as const satisfies readonly DeviceVehicleType[];

/**
 * Device connection status keys derived from the time since the last
 * heartbeat. Used by `deriveDeviceStatus` and the table filter chips.
 */
export const DEVICE_STATUS_KEYS = [
    'online',
    'stale',
    'offline',
    'never-seen',
] as const;
export type DeviceStatusKey = (typeof DEVICE_STATUS_KEYS)[number];

/**
 * Maximum age in minutes before a device is no longer "online".
 */
export const DEVICE_ONLINE_THRESHOLD_MIN = 5;

/**
 * Maximum age in minutes before a device is no longer "stale"
 * (i.e. beyond this, it's considered offline).
 */
export const DEVICE_OFFLINE_THRESHOLD_MIN = 60;

/**
 * Ordered list of statuses for the filter dropdown. `all` is the
 * synthetic "no filter" option; the rest match `DeviceStatusKey`.
 */
export const DEVICE_STATUS_FILTER_OPTIONS = [
    'all',
    'online',
    'stale',
    'offline',
    'never-seen',
] as const;

export type DeviceStatusFilter = (typeof DEVICE_STATUS_FILTER_OPTIONS)[number];

/**
 * Sort options for the devices table. The `recent` and `oldest` modes
 * sort by `last_seen_at`; null timestamps sort last/first respectively.
 */
export const DEVICE_SORT_OPTIONS = [
    'name-asc',
    'name-desc',
    'recent',
    'oldest',
] as const;

export type DeviceSortKey = (typeof DEVICE_SORT_OPTIONS)[number];

/**
 * The role a user has on a device.
 */
export const DEVICE_ACCESS_ROLES = ['owner', 'editor', 'viewer'] as const;
export type DeviceAccessRole = (typeof DEVICE_ACCESS_ROLES)[number];

/**
 * Filter sentinel that means "no vehicle filter".
 */
export const DEVICE_VEHICLE_FILTER_ALL = 'all';
export type DeviceVehicleFilter =
    | typeof DEVICE_VEHICLE_FILTER_ALL
    | DeviceVehicleType;

/**
 * lucide-react does not ship a dedicated `Bike` + `Motorcycle` distinction
 * in all versions. We alias `motorcycle` to its custom variant — the
 * renderer can map the name when no exact match exists. This is the
 * lookup the page uses; the component does the actual switch.
 */
export const VEHICLE_ICON_LOOKUP: Record<DeviceVehicleType, string> = {
    bicycle: 'Bike',
    motorcycle: 'Bike',
    car: 'Car',
    truck: 'Truck',
    van: 'Van',
    other: 'Package',
};
/**
 * Lucide icon per vehicle type.
 * @type {Record<string, LucideIcon>}
 */
export const VEHICLE_ICON_MAP: Record<DeviceVehicleType, LucideIcon> = {
    bicycle: Bike,
    motorcycle: Motorbike,
    car: Car,
    truck: Truck,
    van: Van,
    other: Package,
};
