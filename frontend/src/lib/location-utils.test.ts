import { describe, expect, it } from 'vitest';
import type { LocationPoint } from '@/types/api';
import { splitLocationRoute } from './location-utils';

const point = (recordedAt: string): LocationPoint => ({
    device_id: 'device',
    recorded_at: recordedAt,
    latitude: 19,
    longitude: -99,
    altitude: null,
    speed: null,
    accuracy: null,
    battery_voltage: null,
    signal_strength: null,
});

describe('splitLocationRoute', () => {
    it('orders points and splits gaps larger than the threshold', () => {
        const segments = splitLocationRoute([
            point('2026-08-17T12:00:00Z'),
            point('2026-08-17T12:00:10Z'),
            point('2026-08-17T12:00:20Z'),
            point('2026-08-17T12:00:50Z'),
            point('2026-08-17T12:01:00Z'),
        ]);

        expect(segments).toHaveLength(2);
        expect(segments[0]).toHaveLength(3);
        expect(segments[1]).toHaveLength(2);
        expect(segments[0][0]?.recorded_at).toBe('2026-08-17T12:00:00Z');
    });

    it('does not render single-point segments as lines', () => {
        const segments = splitLocationRoute([
            point('2026-08-17T12:00:00Z'),
            point('2026-08-17T12:01:00Z'),
            point('2026-08-17T12:01:10Z'),
        ]);

        expect(segments).toHaveLength(1);
        expect(segments[0]).toHaveLength(2);
    });
});
