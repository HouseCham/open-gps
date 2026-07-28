import { describe, expect, it } from 'vitest';
import { en } from '@/i18n';
import { getVehicleBatteryMetricTone, getVehicleLabel } from './vehicle-utils';

describe('getVehicleBatteryMetricTone', () => {
    it('returns an empty string for null percentages', () => {
        expect(getVehicleBatteryMetricTone(null)).toBe('');
    });

    it('returns "bad" below 20%', () => {
        expect(getVehicleBatteryMetricTone(0)).toBe('bad');
        expect(getVehicleBatteryMetricTone(19)).toBe('bad');
    });

    it('returns "warn" between 20% and 49%', () => {
        expect(getVehicleBatteryMetricTone(20)).toBe('warn');
        expect(getVehicleBatteryMetricTone(49)).toBe('warn');
    });

    it('returns "ok" at or above 50%', () => {
        expect(getVehicleBatteryMetricTone(50)).toBe('ok');
        expect(getVehicleBatteryMetricTone(80)).toBe('ok');
        expect(getVehicleBatteryMetricTone(100)).toBe('ok');
    });

    it('classifies boundary values exactly as expected', () => {
        expect(getVehicleBatteryMetricTone(19.999)).toBe('bad');
        expect(getVehicleBatteryMetricTone(20)).toBe('warn');
        expect(getVehicleBatteryMetricTone(49.999)).toBe('warn');
        expect(getVehicleBatteryMetricTone(50)).toBe('ok');
    });
});

describe('getVehicleLabel', () => {
    const labels = en.device.table.vehicleTypes;

    it('returns the matching translation key for each vehicle type', () => {
        expect(getVehicleLabel('bicycle', en.device)).toBe(labels.bicycle);
        expect(getVehicleLabel('motorcycle', en.device)).toBe(
            labels.motorcycle
        );
        expect(getVehicleLabel('car', en.device)).toBe(labels.car);
        expect(getVehicleLabel('truck', en.device)).toBe(labels.truck);
        expect(getVehicleLabel('van', en.device)).toBe(labels.van);
        expect(getVehicleLabel('other', en.device)).toBe(labels.other);
    });

    it('returns a non-empty human-readable string', () => {
        expect(getVehicleLabel('car', en.device)).toBe('Car');
        expect(getVehicleLabel('truck', en.device)).toBe('Truck');
    });
});
