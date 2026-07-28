import { useEffect, useState, type JSX, type SubmitEvent } from 'react';
//-- Types
import type { Translation } from '@/i18n';
import type { UpdateUserDto, UserWithDevices } from '@/types/api';
import type { ProfileForm, ProfileFormErrors } from '@/types';
//-- Components
import { Field, Input } from '@/components/react/form/ui';
import { Modal } from '@/components/react/ui';
import { Button } from '@/components/react/ui/button';
//-- Icons
import { Check } from 'lucide-react';

/**
 * Props for the EditProfileModal component
 * @interface EditProfileModalProps
 * @prop {boolean} open - Whether the modal is open
 * @prop {UserWithDevices} user - The user to be edited
 * @prop {Translation['profile']['edit']} translations - Translation strings
 * @prop {() => void} onClose - Callback for closing the modal
 * @prop {() => Promise<void>} onSave - Callback for saving the edited user
 */
interface EditProfileModalProps {
    open: boolean;
    user: UserWithDevices;
    translations: Translation['profile']['edit'];
    onClose: () => void;
    onSave: (payload: UpdateUserDto) => Promise<void>;
}

/**
 * Component for editing a user's profile
 * @param {EditProfileModalProps} props - The props for the component
 * @returns {JSX.Element | null} The rendered component
 */
export function EditProfileModal({
    open,
    user,
    translations: t,
    onClose,
    onSave,
}: EditProfileModalProps): JSX.Element | null {
    const [form, setForm] = useState<ProfileForm>({
        name: user.name,
        lastname: user.lastname,
    });
    const [errors, setErrors] = useState<ProfileFormErrors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setForm({ name: user.name, lastname: user.lastname });
        setErrors({});
        setSubmitError(null);
    }, [open, user]);

    if (!open) return null;

    /**
     * Closes the modal
     * @returns {void}
     */
    const close = (): void => {
        if (!saving) onClose();
    };
    /**
     * Submits the form
     * @param {SubmitEvent<HTMLFormElement>} event - The submit event
     * @returns {Promise<void>}
     */
    const submit = async (
        event?: SubmitEvent<HTMLFormElement>
    ): Promise<void> => {
        event?.preventDefault();
        const nextErrors: ProfileFormErrors = {};
        if (!form.name.trim()) nextErrors.name = t.required;
        if (!form.lastname.trim()) nextErrors.lastname = t.required;
        setErrors(nextErrors);
        setSubmitError(null);
        if (Object.keys(nextErrors).length > 0) return;

        setSaving(true);
        try {
            await onSave({
                name: form.name.trim(),
                lastname: form.lastname.trim(),
            });
        } catch {
            setSubmitError(t.updateFailed);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={close}
            title={t.title}
            subtitle={t.subtitle}
            size="md"
            footer={
                <>
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={saving}
                        onClick={close}
                    >
                        {t.cancel}
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        loading={saving}
                        icon={<Check size={14} aria-hidden="true" />}
                        onClick={() => void submit()}
                    >
                        {saving ? t.saving : t.save}
                    </Button>
                </>
            }
        >
            <form className="profile-edit-form" onSubmit={submit}>
                <Field
                    htmlFor="profile-name"
                    label={t.firstName}
                    required
                    error={errors.name}
                >
                    <Input
                        id="profile-name"
                        value={form.name}
                        maxLength={100}
                        autoComplete="given-name"
                        autoFocus
                        invalid={Boolean(errors.name)}
                        onChange={event =>
                            setForm(current => ({
                                ...current,
                                name: event.target.value,
                            }))
                        }
                    />
                </Field>
                <Field
                    htmlFor="profile-lastname"
                    label={t.lastName}
                    required
                    error={errors.lastname}
                >
                    <Input
                        id="profile-lastname"
                        value={form.lastname}
                        maxLength={100}
                        autoComplete="family-name"
                        invalid={Boolean(errors.lastname)}
                        onChange={event =>
                            setForm(current => ({
                                ...current,
                                lastname: event.target.value,
                            }))
                        }
                    />
                </Field>
                {submitError && (
                    <div className="profile-form-error" role="alert">
                        {submitError}
                    </div>
                )}
                <button type="submit" hidden aria-hidden="true" />
            </form>
        </Modal>
    );
}
