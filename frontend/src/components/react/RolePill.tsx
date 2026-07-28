import type { Translation } from '@/i18n';
import type { DeviceDetail } from '@/types/api';
import type { JSX } from 'react/jsx-runtime';
/**
 * Props for the RolePill component
 * @interface RolePillProps
 * @param {DeviceDetail['access_role']} role - The device access role
 * @param {Translation['device']} translations - The translations object
 */
interface RolePillProps {
    role: DeviceDetail['access_role'];
    translations: Translation['device'];
}
/**
 * The RolePill component
 * @prop {RolePillProps} role - The device access role
 * @returns {JSX.Element} The RolePill component
 */
export function RolePill({ role, translations }: RolePillProps): JSX.Element {
    return (
        <span className={`dd-role dd-role-${role}`}>
            {translations.roles[role]}
        </span>
    );
}
