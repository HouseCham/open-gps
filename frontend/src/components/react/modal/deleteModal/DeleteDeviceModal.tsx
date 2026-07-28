import type { JSX } from 'react/jsx-runtime';
//-- Types
import type { DeviceWithAccess } from '@/types/api';
import type { Translation } from '@/i18n';
//-- Components
import { VehicleIcon } from '@/components/react/features/devices';
//-- Local
import { DeleteModal } from './index';
//-- Utils
import { interpolateTemplate } from '@/lib';

/**
 * Props for the DeleteDeviceModal component.
 * @interface DeleteDeviceModalProps
 * @prop {boolean} open - Whether the modal is open.
 * @prop {DeviceWithAccess | null} device - The device to be deleted.
 * @prop {() => void} onClose - Callback for closing the modal.
 * @prop {() => Promise<void> | void} onConfirm - Callback for confirming the deletion.
 * @prop {Translation['device']} t - Translation strings.
 */
interface DeleteDeviceModalProps {
    open: boolean;
    device: DeviceWithAccess | null;
    onClose: () => void;
    onConfirm: () => Promise<void> | void;
    t: Translation['device'];
}

/**
 * DeleteDeviceModal — type-to-confirm wrapper around `DeleteModal`
 * where the value to type is the device name.
 * @param {DeleteDeviceModalProps} props
 * @returns {JSX.Element | null}
 */
export function DeleteDeviceModal({
    open,
    device,
    onClose,
    onConfirm,
    t,
}: DeleteDeviceModalProps): JSX.Element | null {
    if (!device) return null;

    return (
        <DeleteModal
            open={open}
            onClose={onClose}
            onConfirm={onConfirm}
            title={t.modals.deleteTitle}
            subtitle={t.modals.deleteSubtitle}
            warningTitle={t.modals.deleteWarningTitle}
            warningMessage={t.modals.deleteWarningMessage}
            targetIcon={<VehicleIcon type={device.vehicle_type} size={18} />}
            targetName={device.name}
            targetMeta={
                <>
                    {device.uuid_firmware} ·{' '}
                    {t.table.vehicleTypes[device.vehicle_type]}
                </>
            }
            confirmLabel={interpolateTemplate(t.modals.deleteTypeToConfirm, {
                name: device.name,
            })}
            confirmPlaceholder={device.name}
            confirmValue={device.name}
            tip={t.modals.deleteTip}
            cancelLabel={t.modals.cancel}
            confirmButtonLabel={t.modals.delete}
        />
    );
}
