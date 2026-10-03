import { describe, expect, it } from 'vitest';
import { isGuestLiveSnapshot } from './shareLinkService';

describe('isGuestLiveSnapshot', () => {
    it('accepts the minimal current-location response', () => {
        expect(
            isGuestLiveSnapshot({
                device_name: 'Vehicle',
                location: {
                    recorded_at: '2026-10-02T15:00:00Z',
                    latitude: 19.4,
                    longitude: -99.1,
                },
                presence: { state: 'online_moving' },
                server_time: '2026-10-02T15:00:00Z',
            })
        ).toBe(true);
    });

    it('rejects invalid presence states and malformed coordinates', () => {
        expect(
            isGuestLiveSnapshot({
                device_name: 'Vehicle',
                location: null,
                presence: { state: 'unknown' },
                server_time: '2026-10-02T15:00:00Z',
            })
        ).toBe(false);
        expect(
            isGuestLiveSnapshot({
                device_name: 'Vehicle',
                location: {
                    recorded_at: 'now',
                    latitude: '19.4',
                    longitude: -99.1,
                },
                presence: { state: 'offline' },
                server_time: '2026-10-02T15:00:00Z',
            })
        ).toBe(false);
    });

    it('rejects non-finite and out-of-range coordinates', () => {
        const invalidCoordinates = [
            { latitude: Number.NaN, longitude: 0 },
            { latitude: Number.POSITIVE_INFINITY, longitude: 0 },
            { latitude: -90.1, longitude: 0 },
            { latitude: 90.1, longitude: 0 },
            { latitude: 0, longitude: Number.NEGATIVE_INFINITY },
            { latitude: 0, longitude: -180.1 },
            { latitude: 0, longitude: 180.1 },
        ];

        for (const coordinates of invalidCoordinates) {
            expect(
                isGuestLiveSnapshot({
                    device_name: 'Vehicle',
                    location: {
                        recorded_at: '2026-10-02T15:00:00Z',
                        ...coordinates,
                    },
                    presence: { state: 'offline' },
                    server_time: '2026-10-02T15:00:00Z',
                })
            ).toBe(false);
        }
    });
});
