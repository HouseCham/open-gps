import { describe, expect, it } from 'vitest';
import { en } from '@/i18n';
import { deriveDeviceStatus, getDemoKpiItems } from './device-utils';

describe('getDemoKpiItems', () => {
    it('returns four KPI items', () => {
        expect(getDemoKpiItems(en)).toHaveLength(4);
    });

    it('uses admin + device translations as labels', () => {
        const items = getDemoKpiItems(en);
        expect(items[0]?.label).toBe(en.admin.totalDevices);
        expect(items[1]?.label).toBe(en.admin.onlineNow);
        expect(items[2]?.label).toBe(en.device.offline);
        expect(items[3]?.label).toBe(en.admin.alerts);
    });

    it('emits valid variant/icon/trend literals', () => {
        for (const item of getDemoKpiItems(en)) {
            expect(['neutral', 'success', 'warning', 'danger']).toContain(
                item.variant
            );
            expect(['cpu', 'wifi', 'wifi-off', 'alert']).toContain(item.icon);
            expect(['up', 'down', 'flat']).toContain(item.trend);
        }
    });
});

describe('deriveDeviceStatus', () => {
    const strings = en.device;
    const now = Date.now();

    it('returns never-seen when the timestamp is null', () => {
        expect(deriveDeviceStatus(null, strings).key).toBe('never-seen');
        expect(deriveDeviceStatus(null, strings).dot).toBe('never');
    });

    it('returns online for heartbeats under the 5-minute threshold', () => {
        const iso = new Date(now - 60 * 1000).toISOString();
        expect(deriveDeviceStatus(iso, strings).key).toBe('online');
        expect(deriveDeviceStatus(iso, strings).dot).toBe('success');
    });

    it('returns stale for heartbeats between 5 and 60 minutes', () => {
        const iso = new Date(now - 30 * 60 * 1000).toISOString();
        expect(deriveDeviceStatus(iso, strings).key).toBe('stale');
        expect(deriveDeviceStatus(iso, strings).dot).toBe('warning');
    });

    it('returns offline for heartbeats older than 60 minutes', () => {
        const iso = new Date(now - 4 * 60 * 60 * 1000).toISOString();
        expect(deriveDeviceStatus(iso, strings).key).toBe('offline');
        expect(deriveDeviceStatus(iso, strings).dot).toBe('danger');
    });

    it('returns the localized label for each state', () => {
        const online = deriveDeviceStatus(
            new Date(now - 1000).toISOString(),
            strings
        );
        const stale = deriveDeviceStatus(
            new Date(now - 10 * 60 * 1000).toISOString(),
            strings
        );
        const offline = deriveDeviceStatus(
            new Date(now - 2 * 60 * 60 * 1000).toISOString(),
            strings
        );
        const never = deriveDeviceStatus(null, strings);
        expect(online.label).toBe(strings.online);
        expect(stale.label).toBe(strings.stale);
        expect(offline.label).toBe(strings.offline);
        expect(never.label).toBe(strings.neverSeen);
    });
});
