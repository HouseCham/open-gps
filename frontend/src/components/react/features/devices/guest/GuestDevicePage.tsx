import '@/styles/device-detail.css';
import '@/styles/device-share.css';
import { useEffect, useState, type JSX } from 'react';
//-- Types
import type { Translation } from '@/i18n';
import type { Language } from '@/types';
import type { GuestLiveSnapshot, LocationPoint } from '@/types/api';
import type { DeviceStatus } from '@/types/components';
//-- Utils
import { deviceStatusFromPresence } from '@/lib/device-utils';
import {
    consumeGuestShareLink,
    getGuestLiveSnapshot,
    isGuestLiveSnapshot,
} from '@/lib/api/shareLinkService';
//-- Components
import { MapCard } from '@/components/react/features/devices/location/MapCard';

/**
 * Props for the GuestDevicePage component
 * @interface GuestDevicePageProps
 * @prop {Language} locale - Locale.
 * @prop {Translation['device']} translations - Translations.
 * @prop {Translation['date']} date - Date-related translation strings.
 */
interface GuestDevicePageProps {
    locale: Language;
    translations: Translation['device'];
    dateTranslations: Translation['date'];
}
/**
 * The GuestDevicePage component
 * @param {GuestDevicePageProps} props - Props for the component.
 * @returns {JSX.Element} The JSX element representing the component.
 */
export function GuestDevicePage({
    locale,
    translations: t,
    dateTranslations,
}: GuestDevicePageProps): JSX.Element {
    const [snapshot, setSnapshot] = useState<GuestLiveSnapshot | null>(null);
    const [connection, setConnection] = useState<
        'connecting' | 'live' | 'reconnecting'
    >('connecting');
    const [error, setError] = useState(false);

    useEffect(() => {
        let active = true;
        let source: EventSource | null = null;
        /**
         * Fetches the latest live location data for the guest device and updates the state.
         * @returns {Promise<void>} A promise that resolves when the data has been fetched and the state has been updated.
         */
        const refresh = async (): Promise<void> => {
            const value = await getGuestLiveSnapshot();
            if (active) setSnapshot(value);
        };
        /**
         * Establishes a connection to the guest device stream and updates the state accordingly.
         * @returns {Promise<void>} A promise that resolves when the connection is established.
         */
        const connect = async (): Promise<void> => {
            try {
                const token = new URLSearchParams(
                    window.location.hash.slice(1)
                ).get('token');
                if (token) {
                    await consumeGuestShareLink(token);
                    window.history.replaceState(
                        null,
                        '',
                        `${window.location.pathname}${window.location.search}`
                    );
                }

                try {
                    await refresh();
                } catch {
                    if (active) setConnection('reconnecting');
                }
                if (!active) return;
                const apiOrigin = import.meta.env.PUBLIC_API_URL || '';
                source = new EventSource(
                    `${apiOrigin.replace(/\/+$/, '')}/api/v1/guest/device/stream`,
                    { withCredentials: true }
                );
                const handle = (event: MessageEvent<string>): void => {
                    try {
                        const value: unknown = JSON.parse(event.data);
                        if (!isGuestLiveSnapshot(value)) {
                            throw new Error('Invalid guest location event');
                        }
                        setSnapshot(value);
                        setError(false);
                    } catch {
                        setError(true);
                        source?.close();
                    }
                };
                source.addEventListener('snapshot', handle);
                source.addEventListener('location', handle);
                source.addEventListener('presence', handle);
                source.onopen = (): void => {
                    setConnection('live');
                    setError(false);
                };
                source.onerror = (): void => {
                    setConnection('reconnecting');
                    void refresh().catch(() => {
                        if (active) setConnection('reconnecting');
                    });
                };
            } catch {
                if (active) setError(true);
            }
        };

        void connect();
        return (): void => {
            active = false;
            source?.close();
        };
    }, []);

    // Location data for the guest device, derived from the snapshot if available.
    // If the snapshot is not available, the location will be null.
    const location: LocationPoint | null = snapshot?.location
        ? {
              device_id: '',
              ...snapshot.location,
              altitude: null,
              speed: null,
              accuracy: null,
              battery_voltage: null,
              signal_strength: null,
          }
        : null;
    // Device status for the guest device, derived from the snapshot's presence state if available.
    // If the snapshot is not available, the status will be null.
    const status: DeviceStatus | null = snapshot
        ? deviceStatusFromPresence(snapshot.presence.state, t)
        : null;
    const connectionLabel = {
        live: t.detail.guest.live,
        connecting: t.detail.guest.connecting,
        reconnecting: t.detail.guest.reconnecting,
    }[connection];

    if (error) {
        return (
            <main className="guest-device-shell">
                <section className="guest-device-message" role="alert">
                    <h1>{t.detail.guest.unavailableTitle}</h1>
                    <p>{t.detail.guest.unavailableMessage}</p>
                </section>
            </main>
        );
    }

    if (!snapshot || !status) {
        return (
            <main className="guest-device-shell">
                <p className="guest-device-loading" role="status">
                    {t.detail.guest.loading}
                </p>
            </main>
        );
    }

    return (
        <main className="guest-device-shell">
            <header className="guest-device-header">
                <div>
                    <p>{t.detail.guest.subtitle}</p>
                    <h1>{snapshot.device_name || t.detail.guest.pageTitle}</h1>
                </div>
                <div className="guest-device-status" aria-live="polite">
                    <span
                        className={`guest-device-status-dot guest-device-status-dot--${status.dot}`}
                        aria-hidden="true"
                    />
                    <span>{status.label}</span>
                    <span className="guest-device-connection">
                        {connectionLabel}
                    </span>
                </div>
            </header>
            <MapCard
                location={location}
                locale={locale}
                translations={t}
                date={dateTranslations}
                loading={false}
                onRefresh={() => {
                    void getGuestLiveSnapshot()
                        .then(setSnapshot)
                        .catch(() => setConnection('reconnecting'));
                }}
                displayStatus={status}
            />
        </main>
    );
}
