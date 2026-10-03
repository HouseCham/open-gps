import '@/styles/device-share.css';
import { useEffect, useState, type JSX } from 'react';
//-- Types
import type { Translation } from '@/i18n';
import type { DeviceShareLink } from '@/types/api';
//-- Constants
import { GUEST_SHARE_DURATIONS } from '@/constants/components/ui';
//-- Utils
import {
    createDeviceShareLink,
    listDeviceShareLinks,
    revokeDeviceShareLink,
} from '@/lib/api/shareLinkService';
//-- Components
import { Button } from '@/components/react/ui/button';
import { Modal } from '@/components/react/ui/Modal';

/**
 * Props for the GuestShareModal component
 * @interface GuestShareModalProps
 * @prop {boolean} open - Whether the modal is open.
 * @prop {string} deviceId - The ID of the device to share.
 * @prop {'en' | 'es'} locale - The locale of the user.
 * @prop {() => void} onClose - Callback for closing the modal.
 * @prop {Translation['device']['detail']['sharing']} t - Translation strings.
 */
interface GuestShareModalProps {
    open: boolean;
    deviceId: string;
    locale: 'en' | 'es';
    onClose: () => void;
    t: Translation['device']['detail']['sharing'];
}
/**
 * GuestShareModal component
 * @param {GuestShareModalProps} props - Props for the component.
 * @returns {JSX.Element | null} The GuestShareModal component.
 */
export function GuestShareModal({
    open,
    deviceId,
    locale,
    onClose,
    t,
}: GuestShareModalProps): JSX.Element | null {
    const [durationHours, setDurationHours] = useState<number>(1);
    const [links, setLinks] = useState<DeviceShareLink[]>([]);
    const [createdUrl, setCreatedUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        let active = true;
        setCreatedUrl('');
        setCopied(false);
        setError('');
        setLoading(true);
        void listDeviceShareLinks(deviceId)
            .then(items => {
                if (active) setLinks(items);
            })
            .catch(() => {
                if (active) setError(t.loadFailed);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return (): void => {
            active = false;
        };
    }, [deviceId, open, t.loadFailed]);
    /**
     * Creates a share link for the guest device and updates the state accordingly.
     * @returns {Promise<void>} A promise that resolves when the link has been created and the state has been updated.
     */
    const createLink = async (): Promise<void> => {
        setSaving(true);
        setError('');
        setCreatedUrl('');
        setCopied(false);
        try {
            const created = await createDeviceShareLink(
                deviceId,
                durationHours
            );
            const url = new URL(
                `/${locale}/devices/guest`,
                window.location.origin
            );
            url.hash = new URLSearchParams({ token: created.token }).toString();
            setCreatedUrl(url.toString());
        } catch {
            setError(t.createFailed);
            setSaving(false);
            return;
        }
        setSaving(false);
        try {
            setLinks(await listDeviceShareLinks(deviceId));
        } catch {
            setError(t.loadFailed);
        }
    };
    /**
     * Copies the share link to the clipboard and updates the state accordingly.
     * @returns {Promise<void>} A promise that resolves when the link has been copied and the state has been updated.
     */
    const copyLink = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(createdUrl);
            setCopied(true);
            setError('');
        } catch {
            setError(t.copyFailed);
        }
    };
    /**
     * Revokes a share link for the guest device and updates the state accordingly.
     * @param {string} linkId - The ID of the link to revoke.
     * @returns {Promise<void>} A promise that resolves when the link has been revoked and the state has been updated.
     */
    const revokeLink = async (linkId: string): Promise<void> => {
        if (!window.confirm(t.revokeConfirm)) return;
        setError('');
        try {
            await revokeDeviceShareLink(deviceId, linkId);
            setLinks(current => current.filter(link => link.id !== linkId));
        } catch {
            setError(t.loadFailed);
        }
    };
    /**
     * Returns the duration label for the given number of hours.
     * @param {number} hours - The number of hours.
     * @returns {string} The duration label.
     */
    const durationLabel = (hours: number): string => {
        switch (hours) {
            case 1:
                return t.oneHour;
            case 2:
                return t.twoHours;
            case 4:
                return t.fourHours;
            default:
                return t.eightHours;
        }
    };
    /**
     * Closes the modal and resets the state.
     * @returns {void}
     */
    const close = (): void => {
        if (saving) return;
        setCreatedUrl('');
        setCopied(false);
        onClose();
    };

    let activeLinksContent: JSX.Element;
    if (loading) {
        activeLinksContent = <p role="status">{t.loadingLinks}</p>;
    } else if (links.length === 0) {
        activeLinksContent = <p>{t.noActiveLinks}</p>;
    } else {
        activeLinksContent = (
            <ul>
                {links.map(link => (
                    <li key={link.id}>
                        <span>
                            {t.expiresAt}{' '}
                            {new Intl.DateTimeFormat(locale, {
                                dateStyle: 'short',
                                timeStyle: 'short',
                            }).format(new Date(link.expires_at))}
                        </span>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void revokeLink(link.id)}
                        >
                            {t.revoke}
                        </Button>
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <Modal
            open={open}
            onClose={close}
            dismissible={!saving}
            title={t.guestLinkTitle}
            subtitle={t.guestLinkDescription}
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
                        onClick={() => void createLink()}
                    >
                        {saving ? t.creating : t.create}
                    </Button>
                </>
            }
        >
            <div className="device-share-modal">
                <label className="device-share-duration">
                    <span>{t.duration}</span>
                    <select
                        value={durationHours}
                        onChange={event =>
                            setDurationHours(Number(event.target.value))
                        }
                    >
                        {GUEST_SHARE_DURATIONS.map(hours => (
                            <option key={hours} value={hours}>
                                {durationLabel(hours)}
                            </option>
                        ))}
                    </select>
                </label>

                {createdUrl && (
                    <div className="device-share-created">
                        <input
                            aria-label={t.guestLinkTitle}
                            readOnly
                            value={createdUrl}
                        />
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void copyLink()}
                        >
                            {copied ? t.copied : t.copy}
                        </Button>
                    </div>
                )}

                <section className="device-share-active-links">
                    <h3>{t.activeLinks}</h3>
                    {activeLinksContent}
                </section>
                {error && (
                    <p className="device-share-error" role="alert">
                        {error}
                    </p>
                )}
            </div>
        </Modal>
    );
}
