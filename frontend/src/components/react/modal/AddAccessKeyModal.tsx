import '@/styles/access.css';
import { useEffect, useState, type ChangeEvent, type JSX } from 'react';
//-- Types
import type { ApiKeyRow } from '@/lib/api/services/apiKeyService';
import type { DeviceWithAccess } from '@/types/api';
import type { Translation } from '@/i18n';
//-- Utils
import { interpolateTemplate } from '@/lib';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
//-- Icons
import { AlertTriangle, Check, Copy, KeyRound } from 'lucide-react';
//-- Components
import { Modal } from '@/components/react/ui';
import { Button } from '@/components/react/ui/button';
import { Field, Select } from '@/components/react/form/ui';
import type { AccessModalMode, ApiKeyRevealPayload } from '@/types';

/**
 * Props for the AddAccessKeyModal component.
 * @interface AddAccessKeyModalProps
 * @prop {boolean} open - Whether the modal is open.
 * @prop {() => void} onClose - Callback for closing the modal.
 * @prop {(deviceId: string) => Promise<ApiKeyRevealPayload | null>} onIssue -
 *   Issue a key for the given device. Returns the reveal payload on
 *   success (modal flips to reveal state), or `null` on failure (the
 *   service hook already pushes a toast).
 * @prop {DeviceWithAccess[]} devices - Devices the user can pick.
 * @prop {ApiKeyRow[]} rows - Currently active keys; used to filter the
 *   picker to devices without an active key.
 * @prop {Translation['apiKeys']['modals']} t - Translation strings.
 */
interface AddAccessKeyModalProps {
    open: boolean;
    onClose: () => void;
    onIssue: (deviceId: string) => Promise<ApiKeyRevealPayload | null>;
    devices: DeviceWithAccess[];
    rows: ApiKeyRow[];
    t: Translation['apiKeys']['modals'];
}

/**
 * AddAccessKeyModal — two-state dialog that issues a fresh API key
 * for a chosen device, then surfaces the returned `plain_key` once
 * before discarding it. Mirrors the form-validation/warning-banner
 * patterns used by `AddUserModal` and `AddDeviceModal`.
 * @param {AddAccessKeyModalProps} props
 * @returns {JSX.Element | null}
 */
export function AddAccessKeyModal({
    open,
    onClose,
    onIssue,
    devices,
    rows,
    t,
}: AddAccessKeyModalProps): JSX.Element | null {
    const [mode, setMode] = useState<AccessModalMode>('form');
    const [deviceId, setDeviceId] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);
    const [reveal, setReveal] = useState<ApiKeyRevealPayload | null>(null);
    const [copied, setCopied] = useState(false);

    /**
     * Devices available to issue a key for — any owned device whose id
     * is not already represented in the active-key rows.
     */
    const takenDeviceIds = new Set(rows.map(r => r.device_id));
    const availableDevices = devices.filter(d => !takenDeviceIds.has(d.id));

    useEffect(() => {
        if (open) {
            setMode('form');
            setDeviceId('');
            setError('');
            setSubmitting(false);
            setReveal(null);
            setCopied(false);
        }
    }, [open]);

    if (!open) return null;

    const deviceOptions = availableDevices.map(d => ({
        value: d.id,
        label: d.name,
    }));

    /**
     * Validate the picker and submit.
     * @returns {Promise<void>}
     */
    const submit = async (): Promise<void> => {
        setError('');
        if (!deviceId) {
            setError(t.deviceRequired);
            return;
        }
        const selected = availableDevices.find(d => d.id === deviceId);
        if (!selected) {
            setError(t.deviceRequired);
            return;
        }
        setSubmitting(true);
        const result = await onIssue(selected.id);
        setSubmitting(false);
        if (!result) return;
        setReveal(result);
        setMode('reveal');
    };

    /**
     * Copy the reveal key to the clipboard.
     * @returns {Promise<void>}
     */
    const copyKey = async (): Promise<void> => {
        if (!reveal) return;
        if (await copyToClipboard(reveal.plainKey)) {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        }
    };

    if (mode === 'reveal' && reveal) {
        return (
            <Modal
                open={open}
                onClose={onClose}
                title={t.revealTitle}
                size="md"
                footer={
                    <Button type="button" variant="primary" onClick={onClose}>
                        {t.saved}
                    </Button>
                }
            >
                <div className="access-reveal-banner">
                    <AlertTriangle size={14} strokeWidth={1.8} />
                    <div>
                        {interpolateTemplate(t.revealBanner, {
                            device: reveal.deviceName,
                        })}
                    </div>
                </div>
                <div className="access-reveal-display">
                    <code className="access-reveal-value">
                        {reveal.plainKey}
                    </code>
                    <div className="access-reveal-actions">
                        <Button
                            type="button"
                            variant="secondary"
                            icon={
                                copied ? (
                                    <Check size={14} strokeWidth={1.6} />
                                ) : (
                                    <Copy size={14} strokeWidth={1.6} />
                                )
                            }
                            onClick={() => void copyKey()}
                        >
                            {copied ? t.copied : t.copy}
                        </Button>
                    </div>
                </div>
                <p className="access-reveal-meta">{t.revealMeta}</p>
            </Modal>
        );
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={t.addTitle}
            subtitle={t.addSubtitle}
            size="md"
            footer={
                <>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        disabled={submitting}
                    >
                        {t.cancel}
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        loading={submitting}
                        icon={<KeyRound size={14} strokeWidth={1.6} />}
                        onClick={() => void submit()}
                    >
                        {submitting ? t.issuing : t.issue}
                    </Button>
                </>
            }
        >
            <Field
                label={t.deviceLabel}
                required
                error={error}
                help={
                    availableDevices.length === 0
                        ? t.noDevicesAvailable
                        : undefined
                }
            >
                <Select
                    options={[
                        { value: '', label: t.devicePlaceholder },
                        ...deviceOptions,
                    ]}
                    value={deviceId}
                    invalid={!!error}
                    disabled={availableDevices.length === 0}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                        setDeviceId(e.target.value);
                        if (error) setError('');
                    }}
                />
                {availableDevices.length === 0 && (
                    <div className="access-device-hint">
                        {t.noDevicesAvailable}
                    </div>
                )}
            </Field>
        </Modal>
    );
}
