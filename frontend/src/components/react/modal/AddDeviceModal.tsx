import { useEffect, useState, type ChangeEvent } from 'react';
//-- Types
import { type DeviceAccessRole } from '@/constants';
import type { Translation } from '@/i18n';
import type { DeviceVehicleType } from '@/types/api';
import type { JSX } from 'react/jsx-runtime';
//-- Icons
import { Plus, Sparkles } from 'lucide-react';
//-- Components
import { Modal } from '@/components/react/ui';
import { Button } from '@/components/react/ui/button';
import { Field, Input } from '@/components/react/form/ui';
import { VehicleTypeSelect } from '@/components/react/features/devices';
/**
 * Props for the AddDeviceModal component.
 * @interface AddDeviceModalProps
 * @prop {boolean} open - Whether the modal is open.
 * @prop {() => void} onClose - Callback for closing the modal.
 * @prop {() => Promise<void> | void} onCreate - Callback for creating the device.
 * @prop {Translation['device']} t - Translation strings.
 */
interface AddDeviceModalProps {
    open: boolean;
    onClose: () => void;
    onCreate: (data: {
        name: string;
        uuid_firmware: string;
        vehicle_type: DeviceVehicleType;
        access_role: DeviceAccessRole;
    }) => Promise<void> | void;
    t: Translation['device'];
}
/**
 * Component for adding a new device.
 * @param {AddDeviceModalProps} props - Props for the component.
 * @returns {JSX.Element | null} The rendered component.
 */
export function AddDeviceModal({
    open,
    onClose,
    onCreate,
    t,
}: AddDeviceModalProps): JSX.Element | null {
    const [form, setForm] = useState<{
        uuid_firmware: string;
        name: string;
        vehicle_type: DeviceVehicleType;
        access_role: DeviceAccessRole;
    }>({
        uuid_firmware: '',
        name: '',
        vehicle_type: 'car',
        access_role: 'owner',
    });
    const [errors, setErrors] = useState<{
        name?: string;
        uuid_firmware?: string;
    }>({});

    useEffect(() => {
        if (open) {
            setForm({
                uuid_firmware: '',
                name: '',
                vehicle_type: 'car',
                access_role: 'owner',
            });
            setErrors({});
        }
    }, [open]);

    if (!open) return null;

    /**
     * Submit the form
     * @returns {void}
     */
    const submit = (): void => {
        const e: { name?: string; uuid_firmware?: string } = {};
        if (!form.uuid_firmware.trim()) e.uuid_firmware = t.modals.required;
        if (!form.name.trim()) e.name = t.modals.required;
        setErrors(e);
        if (Object.keys(e).length) return;
        void onCreate(form);
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={t.modals.addTitle}
            subtitle={t.modals.addSubtitle}
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        {t.modals.cancel}
                    </Button>
                    <Button
                        variant="primary"
                        icon={<Plus size={14} strokeWidth={1.6} />}
                        onClick={submit}
                    >
                        {t.modals.add}
                    </Button>
                </>
            }
        >
            <Field
                label={t.modals.nameLabel}
                required
                error={errors.name}
                help={t.modals.nameHint}
            >
                <Input
                    placeholder={t.modals.namePlaceholder}
                    value={form.name}
                    invalid={!!errors.name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setForm(f => ({ ...f, name: e.target.value }))
                    }
                    autoFocus
                />
            </Field>
            <Field
                label={t.modals.uuidLabel}
                required
                error={errors.uuid_firmware}
                help={t.modals.uuidHint}
            >
                <div className="field-with-button">
                    <Input
                        placeholder={t.modals.uuidPlaceholder}
                        value={form.uuid_firmware}
                        invalid={!!errors.uuid_firmware}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setForm(f => ({
                                ...f,
                                uuid_firmware: e.target.value,
                            }))
                        }
                        className="is-mono"
                    />
                    <Button
                        variant="secondary"
                        icon={<Sparkles size={13} strokeWidth={1.6} />}
                        onClick={() =>
                            setForm(f => ({
                                ...f,
                                uuid_firmware: crypto.randomUUID(),
                            }))
                        }
                        type="button"
                    >
                        {t.modals.generateUuid}
                    </Button>
                </div>
            </Field>
            <div className="gp-field-row">
                <Field label={t.modals.vehicleTypeLabel} required>
                    <VehicleTypeSelect
                        value={form.vehicle_type}
                        labels={t.table.vehicleTypes}
                        onChange={vehicleType =>
                            setForm(f => ({ ...f, vehicle_type: vehicleType }))
                        }
                    />
                </Field>
            </div>
        </Modal>
    );
}
