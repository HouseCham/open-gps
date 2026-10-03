import type {
    CreatedDeviceShareLink,
    DeviceShareLink,
    Envelope,
    GuestLiveSnapshot,
} from '@/types/api';
import { apiClient } from '@/lib/api/client';
/**
 * Creates a share link for a device.
 * @param {string} deviceId - The ID of the device to share.
 * @param {number} durationHours - The duration of the share link in hours.
 * @returns {Promise<CreatedDeviceShareLink>} A promise that resolves to the created share link.
 */
export async function createDeviceShareLink(
    deviceId: string,
    durationHours: number
): Promise<CreatedDeviceShareLink> {
    const response = await apiClient<Envelope<CreatedDeviceShareLink>>(
        `/devices/${deviceId}/share-links`,
        { method: 'POST', body: { duration_hours: durationHours } }
    );
    if (!response.data?.data) throw new Error('Empty share link response');
    return response.data.data;
}
/**
 * Lists share links for a device.
 * @param {string} deviceId - The ID of the device to list share links for.
 * @returns {Promise<DeviceShareLink[]>} A promise that resolves to an array of share links.
 */
export async function listDeviceShareLinks(
    deviceId: string
): Promise<DeviceShareLink[]> {
    const response = await apiClient<Envelope<DeviceShareLink[]>>(
        `/devices/${deviceId}/share-links`,
        { method: 'GET' }
    );
    if (!response.data?.data) throw new Error('Empty share link list response');
    return response.data.data;
}
/**
 * Revokes a share link for a device.
 * @param {string} deviceId - The ID of the device to revoke the share link for.
 * @param {string} linkId - The ID of the share link to revoke.
 * @returns {Promise<void>} A promise that resolves when the share link has been revoked.
 */
export async function revokeDeviceShareLink(
    deviceId: string,
    linkId: string
): Promise<void> {
    await apiClient(`/devices/${deviceId}/share-links/${linkId}`, {
        method: 'DELETE',
    });
}
/**
 * Consumes a guest share link.
 * @param {string} token - The token of the share link to consume.
 * @returns {Promise<void>} A promise that resolves when the share link has been consumed.
 */
export async function consumeGuestShareLink(token: string): Promise<void> {
    await apiClient('/guest/share-links/consume', {
        method: 'POST',
        body: { token },
    });
}
/**
 * Retrieves the live snapshot of a guest device.
 * @returns {Promise<GuestLiveSnapshot>} A promise that resolves to the live snapshot of the guest device.
 */
export async function getGuestLiveSnapshot(): Promise<GuestLiveSnapshot> {
    const response = await apiClient<Envelope<GuestLiveSnapshot>>(
        '/guest/device/live',
        { method: 'GET' }
    );
    if (!response.data?.data) throw new Error('Empty guest snapshot response');
    return response.data.data;
}
/**
 * Checks if a value is a guest live snapshot.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a guest live snapshot, false otherwise.
 */
export function isGuestLiveSnapshot(
    value: unknown
): value is GuestLiveSnapshot {
    if (!isRecord(value)) return false;
    if (
        typeof value.device_name !== 'string' ||
        typeof value.server_time !== 'string' ||
        !isRecord(value.presence) ||
        typeof value.presence.state !== 'string' ||
        ![
            'never_seen',
            'online_moving',
            'online_stationary',
            'offline',
        ].includes(value.presence.state)
    ) {
        return false;
    }
    if (value.location === null) return true;
    if (!isRecord(value.location)) return false;
    return (
        typeof value.location.recorded_at === 'string' &&
        typeof value.location.latitude === 'number' &&
        Number.isFinite(value.location.latitude) &&
        value.location.latitude >= -90 &&
        value.location.latitude <= 90 &&
        typeof value.location.longitude === 'number' &&
        Number.isFinite(value.location.longitude) &&
        value.location.longitude >= -180 &&
        value.location.longitude <= 180
    );
}
/**
 * Checks if a value is a record.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a record, false otherwise.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
