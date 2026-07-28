import type { DeviceVehicleType } from '@/types/api';
import type { MarkerStatus } from './map.types';
import type { Translation } from '@/i18n';
import type { DeviceStatusKey } from '@/constants';
/**
 * @interface DeviceTableItem
 * @param {string} id - The ID of the device.
 * @param {string} name - The name of the device.
 * @param {MarkerStatus} status - The status of the device.
 * @param {string | null} lastSeen - The last seen time of the device.
 * @param {number} battery - The battery level of the device.
 * @param {number} signal - The signal strength of the device.
 */
export interface DeviceTableItem {
    id: string;
    name: string;
    status: MarkerStatus;
    lastSeen: string | null;
    battery: number;
    signal: number;
}
/**
 * @interface DeviceCardItem
 * @param {string} uuid_firmware - The UUID of the firmware.
 */
export interface DeviceCardItem extends DeviceTableItem {
    uuid_firmware: string;
}
/**
 * @interface DeviceFormValues
 * @param {string} id - The ID of the device.
 * @param {string} name - The name of the device.
 * @param {string} uuid_firmware - The UUID of the firmware.
 * @param {DeviceVehicleType} vehicle_type - The vehicle category.
 */
export interface DeviceFormValues {
    name: string;
    uuid_firmware: string;
    vehicle_type: DeviceVehicleType;
}
/**
 * @interface DeviceData
 * @param {string} id - The ID of the device.
 * @param {string} name - The name of the device.
 * @param {string} uuid_firmware - The UUID of the firmware.
 * @param {DeviceVehicleType} vehicle_type - The vehicle category.
 */
export interface DeviceData {
    id: string;
    name: string;
    uuid_firmware: string;
    vehicle_type: DeviceVehicleType;
}
/**
 * @interface DeviceFormStrings
 * @param {string} title - The title of the form.
 * @param {string} nameLabel - The label for the name field.
 * @param {string} namePlaceholder - The placeholder for the name field.
 * @param {string} uuidLabel - The label for the UUID field.
 * @param {string} uuidPlaceholder - The placeholder for the UUID field.
 * @param {string} vehicleTypeLabel - The label for the vehicle type field.
 * @param {string} vehicleTypeRequired - The error message for the vehicle type field.
 * @param {string} nameRequired - The error message for the name field.
 * @param {string} uuidRequired - The error message for the UUID field.
 * @param {string} uuidInvalid - The error message for the UUID field.
 * @param {string} save - The label for the save button.
 * @param {string} saving - The label for the saving button.
 * @param {string} cancel - The label for the cancel button.
 * @param {string} deleteConfirm - The confirmation message for the delete button.
 * @param {string} deleteDevice - The label for the delete button.
 * @param {string} generateUuid - The label for the generate-UUID button.
 */
export interface DeviceFormStrings {
    title?: string;
    nameLabel?: string;
    namePlaceholder?: string;
    uuidLabel?: string;
    uuidPlaceholder?: string;
    vehicleTypeLabel?: string;
    vehicleTypeRequired?: string;
    nameRequired?: string;
    uuidRequired?: string;
    uuidInvalid?: string;
    save?: string;
    saving?: string;
    cancel?: string;
    deleteConfirm?: string;
    deleteDevice?: string;
    generateUuid?: string;
}
/**
 * @interface GrantAccessFormStrings
 * @param {string} title - The title of the form.
 * @param {string} userId - Label for the user-id input.
 * @param {string} userIdPlaceholder - Placeholder for the user-id input.
 * @param {string} userIdRequired - Validation error when the field is empty.
 * @param {string} userIdInvalid - Validation error when the UUID format is wrong.
 * @param {string} grant - Label for the submit button.
 * @param {string} granting - Label for the submit button while submitting.
 * @param {string} cancel - Label for the cancel button.
 */
export interface GrantAccessFormStrings {
    title: string;
    userId: string;
    userIdPlaceholder: string;
    userIdRequired: string;
    userIdInvalid: string;
    grant: string;
    granting: string;
    cancel: string;
}
/**
 * @interface DeviceUserAccessTableStrings
 * @param {string} name - The label for the name column.
 * @param {string} email - The label for the email column.
 * @param {string} accessGranted - The label for the access granted column.
 * @param {string} actions - The label for the actions column.
 * @param {string} addUser - The label for the add user button.
 * @param {string} noUsers - The message to display when there are no users.
 * @param {string} remove - The label for the remove button.
 * @param {string} removeTitle - The title for the remove confirmation dialog.
 * @param {string} removeConfirm - The confirmation message for removing a user.
 * @param {string} failedToLoad - The message to display when failing to load users.
 */
export interface DeviceUserAccessTableStrings {
    name: string;
    email: string;
    accessGranted: string;
    actions: string;
    addUser: string;
    noUsers: string;
    remove: string;
    removeTitle: string;
    removeConfirm: string;
    failedToLoad: string;
}
/**
 * The translations for the device access table.
 */
export type DeviceAccessTableTranslations =
    Translation['device']['detail']['accessTable'];
/**
 * The shape returned by `deriveDeviceStatus`. `key` is the canonical
 * machine-readable state; `label` and `dot` are localized + class
 * hints for the table pill.
 * @interface DeviceStatus
 * @param {DeviceStatusKey} key - The canonical machine-readable state.
 * @param {string} label - The localized label.
 * @param {'success' | 'warning' | 'danger' | 'never'} dot - The class hint.
 */
export interface DeviceStatus {
    key: DeviceStatusKey;
    label: string;
    dot: 'success' | 'warning' | 'danger' | 'never';
}
