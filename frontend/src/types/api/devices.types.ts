export interface Envelope<T> {
    status_code: number;
    message: string;
    data: T;
}

export type DeviceVehicleType =
    | 'bicycle'
    | 'motorcycle'
    | 'car'
    | 'truck'
    | 'van'
    | 'other';

export interface Device {
    id: string;
    uuid_firmware: string;
    name: string;
    vehicle_type: DeviceVehicleType;
    created_at: string;
    last_contact_at: string | null;
}

export interface DeviceWithAccess extends Device {
    access_role: 'owner' | 'editor' | 'viewer';
}

export interface DeviceDetail extends DeviceWithAccess {
    users: DeviceAccessListItem[];
}

export interface PaginationMeta {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
}

export interface DeviceListResponse {
    items: DeviceWithAccess[];
    pagination: PaginationMeta;
}

/**
 * Response shape returned by GET /api/v1/devices/count. Carries only
 * the total count of devices the caller has access to, so callers that
 * don't need the full list (e.g. the profile page) avoid fetching
 * every row + their access role.
 * @interface DeviceCountResponse
 * @property {number} total - The number of devices the authenticated
 *   user has access to (soft-deleted devices and grants excluded).
 */
export interface DeviceCountResponse {
    total: number;
}
/**
 * @typedef {Object} CreateDeviceDto
 * @property {string} uuid_firmware - The UUID of the firmware.
 * @property {string} name - The name of the device.
 * @property {DeviceVehicleType} vehicle_type - The vehicle type of the device.
 */
export interface CreateDeviceDto {
    uuid_firmware: string;
    name: string;
    vehicle_type: DeviceVehicleType;
}
/**
 * @typedef {Object} UpdateDeviceDto
 * @property {string} name - The name of the device.
 * @property {DeviceVehicleType} vehicle_type - The vehicle type of the device.
 */
export interface UpdateDeviceDto {
    name: string;
    vehicle_type?: DeviceVehicleType;
}
/**
 * @typedef {Object} DeviceAccess
 * @property {string} user_id - The ID of the user.
 * @property {string} device_id - The ID of the device.
 * @property {'viewer'} role - The role of the user on the device (only 'viewer' is allowed).
 * @property {string} created_at - The date and time when access was granted.
 */
export interface DeviceAccess {
    user_id: string;
    device_id: string;
    role: 'viewer';
    created_at: string;
}
/**
 * @typedef {Object} DeviceAccessListItem
 * @property {string} user_id - The ID of the user.
 * @property {string} name - The name of the user.
 * @property {string} email - The email address of the user.
 * @property {'owner' | 'editor' | 'viewer'} role - The role of the user on the device.
 * @property {string} access_granted_at - The date and time when access was granted.
 */
export interface DeviceAccessListItem {
    user_id: string;
    name: string;
    email: string;
    role: 'owner' | 'editor' | 'viewer';
    access_granted_at: string;
}
