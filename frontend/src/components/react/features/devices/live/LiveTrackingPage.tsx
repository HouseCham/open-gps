import '@/styles/device-detail.css';
import '@/styles/live-tracking.css';
import { useEffect, useRef, useState, type JSX } from 'react';
//-- Types
import type { Translation } from '@/i18n';
import type { LocationPoint } from '@/types/api';
import type { DateRange, Language } from '@/types';
//-- Services
import { useDeviceService } from '@/lib/api/services/deviceService';
import { useLocationService } from '@/lib/api/services/locationService';
//-- Utils
import { deriveDeviceStatus } from '@/lib/device-utils';
import {
    downloadCsv,
    formatDateMetric,
    formatHistoryTime,
    getDateRange,
    readDeviceIdFromUrl,
    redirectTo,
    toApiDate,
} from '@/lib';
import { toastBus } from '@/lib/stores/toast.store';
//-- Constants
import {
    LIVE_POLL_INTERVAL_MS,
    LIVE_STALE_RETRIES,
    LIVE_STALE_THRESHOLD_MS,
    LOCATION_HISTORY_PAGE_SIZE,
} from '@/constants/components';
//-- Components
import { Breadcrumbs, EmptyState, Pagination } from '@/components/react/ui';
import { Button } from '@/components/react/ui/button';
import {
    KpiStrip,
    VehicleDetailHeader,
    GpsTelemetrySection,
    DeviceDetailError,
} from '@/components/react/features/devices/detail';
//-- Icons
import { Download, Info, RefreshCw, Route } from 'lucide-react';

/**
 * Props for the LiveTrackingPage component
 * @interface LiveTrackingPageProps
 * @prop {Language} locale - Locale.
 * @prop {Translation['device']} translations - Translations.
 * @prop {Translation['date']} dateTranslations - Date-related translation strings.
 * @prop {string} pageLabel - Page label.
 */
interface LiveTrackingPageProps {
    locale: Language;
    translations: Translation['device'];
    dateTranslations: Translation['date'];
    pageLabel: string;
}

/**
 * The LiveTrackingPage component
 * @param {LiveTrackingPageProps} props - Props for the component
 * @returns {JSX.Element} The rendered LiveTrackingPage component
 */
export function LiveTrackingPage({
    locale,
    translations: t,
    dateTranslations: date,
    pageLabel,
}: LiveTrackingPageProps): JSX.Element {
    const {
        device,
        isLoading: deviceLoading,
        error: deviceError,
        getDeviceById,
    } = useDeviceService();
    const {
        latest,
        history,
        historyPagination,
        isLoading: locationLoading,
        error: locationError,
        getLatestLocation,
        getLocationHistory,
    } = useLocationService();
    const [deviceId, setDeviceId] = useState<string | null | undefined>();
    const [liveMode, setLiveMode] = useState(false);
    const [range, setRange] = useState<DateRange>(() => getDateRange('today'));
    const latestRef = useRef<LocationPoint | null>(null);

    useEffect(() => {
        const id = readDeviceIdFromUrl();
        setDeviceId(id);
        if (!id) return;
        void Promise.all([
            getDeviceById(id),
            getLatestLocation(id),
            getLocationHistory(
                id,
                toApiDate(range.from),
                toApiDate(range.to),
                Intl.DateTimeFormat().resolvedOptions().timeZone
            ),
        ]);
    }, []);

    useEffect(() => {
        latestRef.current = latest;
    }, [latest]);

    useEffect(() => {
        if (!liveMode || !deviceId) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const isStale = (): boolean => {
            const recordedAt = latestRef.current?.recorded_at;
            return recordedAt
                ? Date.now() - new Date(recordedAt).getTime() >
                      LIVE_STALE_THRESHOLD_MS
                : false;
        };
        const poll = async (): Promise<void> => {
            if (cancelled) return;
            await getLatestLocation(deviceId);
            if (cancelled) return;
            for (
                let retry = 0;
                retry < LIVE_STALE_RETRIES && isStale();
                retry += 1
            ) {
                await getLatestLocation(deviceId);
                if (cancelled) return;
            }
            if (isStale()) {
                setLiveMode(false);
                toastBus.push({
                    variant: 'warning',
                    title: t.live.deviceNotLiveTitle,
                    message: t.live.deviceNotLiveMessage,
                });
                return;
            }
            timer = setTimeout(() => void poll(), LIVE_POLL_INTERVAL_MS);
        };
        void poll();
        return (): void => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [deviceId, liveMode]);

    const loadHistory = (nextRange: DateRange, page = 1): void => {
        if (!deviceId) return;
        setRange(nextRange);
        void getLocationHistory(
            deviceId,
            toApiDate(nextRange.from),
            toApiDate(nextRange.to),
            Intl.DateTimeFormat().resolvedOptions().timeZone,
            page,
            LOCATION_HISTORY_PAGE_SIZE
        );
    };
    /**
     * Handle the form submission for the history date range
     * @param {{ preventDefault: () => void }} event - The form submission event
     * @returns {void}
     */
    const handleHistorySubmit = (event: {
        preventDefault: () => void;
    }): void => {
        event.preventDefault();
        loadHistory(range);
    };
    const goBack = (): void =>
        redirectTo(`/devices/detail?id=${deviceId ?? ''}`);
    const status = device
        ? deriveDeviceStatus(latest?.recorded_at ?? '', t)
        : null;

    if (deviceId === undefined || deviceLoading)
        return (
            <div className="live-loading" role="status">
                {t.live.loading}
            </div>
        );
    if (!deviceId)
        return (
            <EmptyState
                title={t.live.missingDeviceTitle}
                message={t.live.missingDeviceMessage}
                action={
                    <Button
                        variant="primary"
                        onClick={() => redirectTo(`/devices/`)}
                    >
                        {t.live.backToDevices}
                    </Button>
                }
            />
        );
    if (!device || !status)
        return (
            <>
                <DeviceDetailError
                    message={deviceError?.message ?? t.live.failedToLoad}
                    onRetry={() => void getDeviceById(deviceId)}
                    retryLabel={t.live.retry}
                />
                <Button
                    variant="secondary"
                    onClick={() => redirectTo(`/devices/`)}
                >
                    {t.live.backToDevices}
                </Button>
            </>
        );

    return (
        <div className="live-page">
            <Breadcrumbs
                items={[
                    { label: t.detail.workspace, href: `/${locale}/` },
                    { label: pageLabel, href: `/${locale}/devices/` },
                    {
                        label: device.name,
                        href: `/${locale}/devices/detail?id=${deviceId}`,
                    },
                    { label: t.live.title },
                ]}
            />

            {/* Header Section */}
            <VehicleDetailHeader
                device={{
                    ...device,
                    last_seen_at: latest?.recorded_at ?? null,
                }}
                status={status}
                locale={locale}
                translations={t}
                date={date}
                onBack={goBack}
            />

            {/* Location Error */}
            {locationError && (
                <DeviceDetailError
                    message={locationError.message}
                    onRetry={() => void getLatestLocation(deviceId)}
                    retryLabel={t.live.retry}
                />
            )}
            {/* KPI Cards */}
            <KpiStrip
                device={device}
                location={latest}
                status={status}
                locale={locale}
                translations={t}
                date={date}
            />

            {/* Detective Mode */}
            <section className="live-section">
                <div className="live-section-head">
                    <div>
                        <h2>{t.live.detectiveMode}</h2>
                        <p>{t.live.detectiveDescription}</p>
                    </div>
                    <span className="live-available">
                        <Route size={13} />
                        {historyPagination?.total ?? 0} {t.live.pointsAvailable}
                    </span>
                </div>
                <div className="live-card live-detective">
                    <form className="live-form" onSubmit={handleHistorySubmit}>
                        <label>
                            <span>{t.live.from}</span>
                            <input
                                type="datetime-local"
                                value={range.from}
                                onChange={event =>
                                    setRange(value => ({
                                        ...value,
                                        from: event.target.value,
                                    }))
                                }
                            />
                        </label>
                        <label>
                            <span>{t.live.to}</span>
                            <input
                                type="datetime-local"
                                value={range.to}
                                onChange={event =>
                                    setRange(value => ({
                                        ...value,
                                        to: event.target.value,
                                    }))
                                }
                            />
                        </label>
                        <Button
                            type="submit"
                            variant="primary"
                            loading={locationLoading}
                            icon={<RefreshCw size={14} />}
                        >
                            {t.live.applyWindow}
                        </Button>
                    </form>
                    <div className="live-filters">
                        {(['today', '24h', '7d'] as const).map(kind => (
                            <button
                                type="button"
                                key={kind}
                                className="live-filter"
                                onClick={() => loadHistory(getDateRange(kind))}
                            >
                                {t.live.ranges[kind]}
                            </button>
                        ))}
                        <button
                            type="button"
                            className="live-filter"
                            onClick={() =>
                                document
                                    .querySelector<HTMLInputElement>(
                                        'input[type="datetime-local"]'
                                    )
                                    ?.focus()
                            }
                        >
                            {t.live.ranges.custom}
                        </button>
                    </div>
                    <div className="live-note">
                        <Info size={14} />
                        {t.live.detectiveNote}
                    </div>
                </div>
            </section>

            {/* GPS Telemetry Section */}
            <GpsTelemetrySection
                title={t.detail.gpsTelemetry}
                description={t.detail.gpsTelemetryDescription}
                latest={
                    latest
                        ? {
                              ...latest,
                              recorded_at: device.created_at,
                          }
                        : null
                }
                locale={locale}
                translations={t}
                date={date}
                loading={locationLoading}
                deviceId={deviceId}
                getLatestLocation={getLatestLocation}
            />

            {/* History Table */}
            <section className="live-section">
                <div className="live-section-head">
                    <div>
                        <h2>{t.live.locationHistory}</h2>
                        <p>
                            {t.live.showing
                                .replace('{shown}', String(history.length))
                                .replace(
                                    '{total}',
                                    String(historyPagination?.total ?? 0)
                                )}
                        </p>
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={<Download size={14} />}
                        onClick={() => downloadCsv(device, history, t.live)}
                    >
                        {t.live.export}
                    </Button>
                </div>
                <div className="live-card live-table-card">
                    <div className="live-table-wrap">
                        <table className="live-table">
                            <thead>
                                <tr>
                                    <th>{t.live.recorded}</th>
                                    <th>{t.live.coordinates}</th>
                                    <th>{t.live.speed}</th>
                                    <th>{t.live.altitude}</th>
                                    <th>{t.live.accuracy}</th>
                                    <th>{t.live.source}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map(point => (
                                    <tr
                                        key={`${point.recorded_at}-${point.latitude}`}
                                    >
                                        <td className="live-time">
                                            {formatHistoryTime(
                                                point.recorded_at,
                                                locale
                                            )}
                                        </td>
                                        <td className="live-coordinates-cell">
                                            {point.latitude.toFixed(6)},{' '}
                                            {point.longitude.toFixed(6)}
                                        </td>
                                        <td>
                                            {formatDateMetric(
                                                point.speed,
                                                t.live.speedUnit
                                            )}
                                        </td>
                                        <td>
                                            {formatDateMetric(
                                                point.altitude,
                                                t.live.meters
                                            )}
                                        </td>
                                        <td>
                                            {point.accuracy == null
                                                ? '—'
                                                : `±${point.accuracy.toFixed(1)} ${t.live.meters}`}
                                        </td>
                                        <td>{t.live.cellular}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {history.length === 0 && (
                            <div className="live-empty">
                                {locationLoading
                                    ? t.live.loadingHistory
                                    : t.live.noHistory}
                            </div>
                        )}
                    </div>
                    {historyPagination && (
                        <div className="live-table-foot">
                            <span>{t.live.ingestionInterval}</span>
                            <Pagination
                                current={historyPagination.page}
                                total={historyPagination.total_pages}
                                onChange={page => loadHistory(range, page)}
                            />
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
