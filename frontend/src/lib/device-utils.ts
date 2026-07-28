import type { Translation } from '@/i18n';
import type { AdminStatItem, DeviceStatus } from '@/types/components';
import {
    DEVICE_OFFLINE_THRESHOLD_MIN,
    DEVICE_ONLINE_THRESHOLD_MIN,
} from '@/constants/device';

/**
 * Derives the connection status of a device from its last heartbeat.
 * Uses the same thresholds as the backend (5 min online, 60 min
 * stale, beyond that offline; null = never-seen) so the UI pill
 * matches what the server reports.
 * @param {string | null} lastSeenIso - ISO timestamp of the last heartbeat, or null when the device never reported.
 * @param {Translation['device']} strings - Localized labels.
 * @returns {DeviceStatus} The status key, label, and dot tone.
 */
export function deriveDeviceStatus(
    lastSeenIso: string | null,
    strings: Translation['device']
): DeviceStatus {
    if (!lastSeenIso) {
        return { key: 'never-seen', label: strings.neverSeen, dot: 'never' };
    }
    const ageMin = (Date.now() - new Date(lastSeenIso).getTime()) / 60000;
    if (ageMin < DEVICE_ONLINE_THRESHOLD_MIN) {
        return { key: 'online', label: strings.online, dot: 'success' };
    }
    if (ageMin < DEVICE_OFFLINE_THRESHOLD_MIN) {
        return {
            key: 'stale',
            label: strings.stale ?? strings.offline,
            dot: 'warning',
        };
    }
    return { key: 'offline', label: strings.offline, dot: 'danger' };
}

/**
 * Get the demo KPI items for the admin dashboard.
 * @param {Translation} t - The translation object.
 * @returns {AdminStatItem[]} The demo KPI items for the admin dashboard.
 */
export function getDemoKpiItems(t: Translation): Array<AdminStatItem> {
    return [
        {
            label: t.admin.totalDevices,
            value: 24,
            icon: 'cpu' as const,
            trend: 'up' as const,
            trendValue: '+3 today',
            variant: 'neutral' as const,
        },
        {
            label: t.admin.onlineNow,
            value: 18,
            icon: 'wifi' as const,
            trend: 'up' as const,
            trendValue: '+2',
            variant: 'success' as const,
        },
        {
            label: t.device.offline,
            value: 5,
            icon: 'wifi-off' as const,
            trend: 'down' as const,
            trendValue: '-1',
            variant: 'warning' as const,
        },
        {
            label: t.admin.alerts,
            value: 1,
            icon: 'alert' as const,
            trend: 'flat' as const,
            trendValue: '0',
            variant: 'danger' as const,
        },
    ];
}
