
export * from './api/services/userService';
export * from './api/services/deviceService';
export * from './device-utils';
export * from './map-utils';
export * from './router-utils';
export * from './user-utils';
export * from './date-utils';
export * from './http-utils';
export * from './layout-utils';
export * from './copy-to-clipboard';
export * from './number-utils';
export * from './i18n-utils';

/**
 * Interpolate the given template with the given variables.
 * @param {string} template - The template to interpolate.
 * @param {Record<string, string | number>} vars - The variables to interpolate.
 */
export function interpolateTemplate(
    template: string,
    vars: Record<string, string | number>
): string {
    return template.replace(/\{(\w+)\}/g, (_, key: string) =>
        vars[key] === undefined ? `{${key}}` : String(vars[key])
    );
}
