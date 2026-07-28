import { useEffect, useState, type JSX } from 'react';
//-- Types
import type { Translation } from '@/i18n';
//-- Components
import { Modal } from '@/components/react/ui';
import { Button } from '@/components/react/ui/button';
import { Field, Input } from '@/components/react/form/ui';
/**
 * Props for the GrantAccessModal component
 * @interface GrantAccessModalProps
 * @prop {boolean} open - Whether the modal is open.
 * @prop {() => void} onClose - Callback for closing the modal.
 * @prop {() => Promise<void>} onGrant - Callback for granting access.
 * @prop {boolean} loading - Loading state.
 * @prop {Translation['device']['detail']['accessTable']} t - Translation strings.
 */
interface GrantAccessModalProps {
    open: boolean;
    onClose: () => void;
    onGrant: (userId: string) => Promise<void>;
    loading: boolean;
    t: Translation['device']['detail']['accessTable'];
}
/**
 * Modal for granting access to a device.
 * @param {GrantAccessModalProps} props - Props for the component.
 * @returns {JSX.Element | null} The rendered component.
 */
export function GrantAccessModal({
    open,
    onClose,
    onGrant,
    loading,
    t,
}: GrantAccessModalProps): JSX.Element | null {
    const [userId, setUserId] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (open) {
            setUserId('');
            setError('');
        }
    }, [open]);

    if (!open) return null;

    const submit = async (): Promise<void> => {
        const value = userId.trim();
        if (!value) {
            setError(t.userIdRequired);
            return;
        }
        setError('');
        await onGrant(value);
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={t.addUser}
            subtitle={t.inviteSubtitle}
            size="sm"
            footer={
                <>
                    <Button type="button" variant="secondary" onClick={onClose}>
                        {t.cancel}
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        loading={loading}
                        onClick={() => void submit()}
                    >
                        {loading ? t.inviting : t.invite}
                    </Button>
                </>
            }
        >
            <Field label={t.userIdLabel} required error={error}>
                <Input
                    value={userId}
                    placeholder={t.userIdPlaceholder}
                    invalid={!!error}
                    autoFocus
                    onChange={event => setUserId(event.target.value)}
                />
            </Field>
        </Modal>
    );
}
