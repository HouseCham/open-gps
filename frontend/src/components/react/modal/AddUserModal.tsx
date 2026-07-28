import { useEffect, useState, type ChangeEvent, type JSX } from 'react';
//-- Types
import type { CreateUserDto } from '@/types/api';
import type { Translation } from '@/i18n';
//-- Components
import { Modal } from '@/components/react/ui';
import { Button } from '@/components/react/ui/button';
import { Field, Input } from '@/components/react/form/ui';
//-- Icons
import { UserPlus } from 'lucide-react';

/**
 * Props for the AddUserModal component.
 * @interface AddUserModalProps
 * @prop {boolean} open - Whether the modal is open.
 * @prop {() => void} onClose - Callback for closing the modal.
 * @prop {(payload: CreateUserDto) => Promise<void> | void} onCreate - Callback invoked with the form payload when the user clicks Create.
 * @prop {boolean} loading - Disables the submit button while the request is in flight.
 * @prop {Translation['admin']['createUser']} t - Translation strings for the create form.
 * @prop {Translation['user']['create']} createT - Translation strings for the modal chrome.
 */
interface AddUserModalProps {
    open: boolean;
    onClose: () => void;
    onCreate: (payload: CreateUserDto) => Promise<void> | void;
    loading: boolean;
    t: Translation['admin']['createUser'];
    createT: Translation['user']['create'];
}

interface FormState {
    email: string;
    name: string;
    lastname: string;
}

/**
 * AddUserModal — form used to create a new user.
 * @param {AddUserModalProps} props
 * @returns {JSX.Element | null}
 */
export function AddUserModal({
    open,
    onClose,
    onCreate,
    loading,
    t,
    createT,
}: AddUserModalProps): JSX.Element | null {
    const [form, setForm] = useState<FormState>({
        email: '',
        name: '',
        lastname: '',
    });
    const [errors, setErrors] = useState<
        Partial<Record<keyof FormState, string>>
    >({});

    useEffect(() => {
        if (open) {
            setForm({ email: '', name: '', lastname: '' });
            setErrors({});
        }
    }, [open]);

    if (!open) return null;

    /**
     * Validate and submit the form.
     * @returns {void}
     */
    const submit = (): void => {
        const e: Partial<Record<keyof FormState, string>> = {};
        if (!form.email.trim()) e.email = t.emailRequired;
        if (!form.name.trim()) e.name = t.nameRequired;
        setErrors(e);
        if (Object.keys(e).length > 0) return;

        const payload: CreateUserDto = {
            email: form.email.trim(),
            name: form.name.trim(),
        };
        if (form.lastname.trim()) payload.lastname = form.lastname.trim();

        void onCreate(payload);
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={createT.title}
            size="md"
            footer={
                <>
                    <Button type="button" variant="secondary" onClick={onClose}>
                        {createT.cancel}
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        loading={loading}
                        icon={<UserPlus size={14} strokeWidth={1.6} />}
                        onClick={submit}
                    >
                        {loading ? t.creating : createT.create}
                    </Button>
                </>
            }
        >
            <Field label={t.email} required error={errors.email}>
                <Input
                    type="email"
                    placeholder={t.emailPlaceholder}
                    value={form.email}
                    invalid={!!errors.email}
                    autoFocus
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setForm(f => ({ ...f, email: e.target.value }))
                    }
                />
            </Field>
            <div className="gp-field-row">
                <Field
                    label={t.name}
                    required
                    error={errors.name}
                    help={!errors.name ? t.namePlaceholder : undefined}
                >
                    <Input
                        type="text"
                        placeholder={t.namePlaceholder}
                        value={form.name}
                        invalid={!!errors.name}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setForm(f => ({ ...f, name: e.target.value }))
                        }
                    />
                </Field>
                <Field label={t.lastname} help={t.lastnamePlaceholder}>
                    <Input
                        type="text"
                        placeholder={t.lastnamePlaceholder}
                        value={form.lastname}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setForm(f => ({
                                ...f,
                                lastname: e.target.value,
                            }))
                        }
                    />
                </Field>
            </div>
        </Modal>
    );
}
