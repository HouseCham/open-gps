import '@/styles/components/delete-modal.css';
import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import type { JSX } from 'react/jsx-runtime';
//-- Icons
import { AlertTriangle, Trash2 } from 'lucide-react';
//-- Components
import { Modal } from '@/components/react/ui';
import { Button } from '@/components/react/ui/button';
import { Field, Input } from '@/components/react/form/ui';

/**
 * Props for the generic DeleteModal.
 * @interface DeleteModalProps
 * @prop {boolean} open - Whether the modal is open.
 * @prop {() => void} onClose - Callback for closing the modal.
 * @prop {() => Promise<void> | void} onConfirm - Callback for confirming the deletion.
 * @prop {boolean} [loading] - Disable the destructive button while the request runs.
 * @prop {string} title - Modal title.
 * @prop {string} [subtitle] - Optional modal subtitle.
 * @prop {string} warningTitle - Title of the warning banner.
 * @prop {string} warningMessage - Body of the warning banner.
 * @prop {ReactNode} targetIcon - Icon shown next to the target preview.
 * @prop {ReactNode} targetName - Primary text identifying the target.
 * @prop {ReactNode} [targetMeta] - Secondary line under the target name.
 * @prop {string} confirmLabel - Label of the type-to-confirm field.
 * @prop {string} confirmPlaceholder - Placeholder of the confirm input.
 * @prop {string} confirmValue - Exact text the user must type.
 * @prop {string} [confirmError] - Error shown when input does not match.
 * @prop {string} [tip] - Helper text rendered below the confirm field.
 * @prop {string} cancelLabel - Cancel button label.
 * @prop {string} confirmButtonLabel - Destructive button label.
 */
interface DeleteModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void> | void;
    loading?: boolean;
    title: string;
    subtitle?: string;
    warningTitle: string;
    warningMessage: string;
    targetIcon: ReactNode;
    targetName: ReactNode;
    targetMeta?: ReactNode;
    confirmLabel: string;
    confirmPlaceholder: string;
    confirmValue: string;
    confirmError?: string;
    tip?: string;
    cancelLabel: string;
    confirmButtonLabel: string;
}

/**
 * DeleteModal — generic destructive-action confirmation. Renders the
 * warning banner, target preview, type-to-confirm field and tip in a
 * fixed layout. Domain-specific modals feed it the strings and target.
 * @param {DeleteModalProps} props
 * @returns {JSX.Element | null}
 */
export function DeleteModal({
    open,
    onClose,
    onConfirm,
    loading = false,
    title,
    subtitle,
    warningTitle,
    warningMessage,
    targetIcon,
    targetName,
    targetMeta,
    confirmLabel,
    confirmPlaceholder,
    confirmValue,
    confirmError,
    tip,
    cancelLabel,
    confirmButtonLabel,
}: DeleteModalProps): JSX.Element | null {
    const [typed, setTyped] = useState('');

    useEffect(() => {
        if (open) setTyped('');
    }, [open]);

    if (!open) return null;

    const canConfirm =
        typed.trim().toLowerCase() === confirmValue.trim().toLowerCase();
    const mismatch = !!typed && !canConfirm;

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            subtitle={subtitle}
            size="sm"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        {cancelLabel}
                    </Button>
                    <Button
                        variant="destructive"
                        loading={loading}
                        disabled={!canConfirm}
                        icon={<Trash2 size={14} strokeWidth={1.6} />}
                        onClick={() => void onConfirm()}
                    >
                        {confirmButtonLabel}
                    </Button>
                </>
            }
        >
            <div className="modal-delete-warn">
                <span className="modal-delete-warn-icon">
                    <AlertTriangle size={16} strokeWidth={1.6} />
                </span>
                <div className="modal-delete-warn-body">
                    <div className="modal-delete-warn-title">
                        {warningTitle}
                    </div>
                    <div className="modal-delete-warn-msg">
                        {warningMessage}
                    </div>
                </div>
            </div>
            <div className="delete-target">
                <span className="delete-target-icon">{targetIcon}</span>
                <div className="delete-target-info">
                    <div className="delete-target-name">{targetName}</div>
                    {targetMeta && (
                        <div className="delete-target-meta">{targetMeta}</div>
                    )}
                </div>
            </div>
            <Field
                label={confirmLabel}
                error={mismatch ? confirmError : undefined}
            >
                <Input
                    type="text"
                    value={typed}
                    placeholder={confirmPlaceholder}
                    invalid={mismatch}
                    autoFocus
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setTyped(e.target.value)
                    }
                />
            </Field>
            {tip && <div className="confirm-prompt">{tip}</div>}
        </Modal>
    );
}
