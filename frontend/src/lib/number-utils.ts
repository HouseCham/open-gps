/**
 * Renders a number with a unit. Example: 1.23 km/h
 * @param {number | null} value - The value to render.
 * @param {string} unit - The unit to render.
 * @param {number} digits - The number of digits to render.
 * @returns {string} The rendered number with unit.
 */
export function renderNumberWithUnit(
    value: number | null | undefined,
    unit: string,
    digits = 0
): string {
    return value == null ? '—' : `${value.toFixed(digits)} ${unit}`;
}

/**
 * Clamps a value between min and max.
 * @param {number} value - The value to clamp.
 * @param {number} min - The minimum value.
 * @param {number} max - The maximum value.
 * @returns {number} The clamped value.
 */
export function clampValue(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
