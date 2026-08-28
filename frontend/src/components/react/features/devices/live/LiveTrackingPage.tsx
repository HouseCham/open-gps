import '@/styles/device-detail.css';
import '@/styles/live-tracking.css';
import { useEffect, useState, type JSX } from 'react';
//-- Types
import type { Translation } from '@/i18n';
import type { DateRange, Language } from '@/types';
import type { DeviceStatus } from '@/types/components';
import type { LocationPoint } from '@/types/api';
//-- Services
import { useDeviceService } from '@/lib/api/services/deviceService';
import { useLocationService } from '@/lib/api/services/locationService';
//-- Utils
import {
    downloadCsv,
    formatDateMetric,
    formatHistoryTime,
    getDateRange,
    readDeviceIdFromUrl,
    redirectTo,
    splitLocationRoute,
    toApiDate,
} from '@/lib';
//-- Constants
import {
    LIVE_POLL_INTERVAL_MS,
    LIVE_STALE_THRESHOLD_MS,
    LOCATION_HISTORY_PAGE_SIZE,
} from '@/constants/components';
//-- Components
import {
    Badge,
    Breadcrumbs,
    EmptyState,
    Pagination,
} from '@/components/react/ui';
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
        route,
        latestLoading,
        historyLoading,
        routeLoading,
        latestError,
        historyError,
        routeError,
        getLatestLocation,
        getLocationHistory,
        getLocationRoute,
    } = useLocationService();
    const [deviceId, setDeviceId] = useState<string | null | undefined>();
    const [range, setRange] = useState<DateRange>(() => getDateRange('today'));
    const [detectiveMode, setDetectiveMode] = useState(false);
    const [routeStyle, setRouteStyle] = useState<'line' | 'dots'>('line');
    const [liveRoutePoints, setLiveRoutePoints] = useState<LocationPoint[]>([]);

    useEffect(() => {
        const id = readDeviceIdFromUrl();
        setDeviceId(id);
    }, []);

    useEffect(() => {
        if (!deviceId) return;
        void getDeviceById(deviceId);
    }, [deviceId]);

    useEffect(() => {
        if (!deviceId) return;
        const rangeTo = new Date(range.to).getTime();
        const includesPresent = rangeTo + 60_000 >= Date.now();
        if (detectiveMode && !includesPresent) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const poll = async (): Promise<void> => {
            if (cancelled) return;
            await getLatestLocation(deviceId, true);
            if (cancelled) return;
            timer = setTimeout(() => void poll(), LIVE_POLL_INTERVAL_MS);
        };
        void poll();
        return (): void => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [deviceId, detectiveMode, range.to]);

    useEffect(() => {
        if (
            !latest ||
            (detectiveMode &&
                new Date(range.to).getTime() + 60_000 < Date.now())
        )
            return;
        setLiveRoutePoints(points =>
            points.some(point => point.recorded_at === latest.recorded_at)
                ? points
                : [...points, latest]
        );
    }, [latest, detectiveMode, range.to]);

    const loadHistory = (nextRange: DateRange, page = 1): void => {
        if (!deviceId) return;
        const rangeChanged =
            nextRange.from !== range.from || nextRange.to !== range.to;
        setRange(nextRange);
        setLiveRoutePoints([]);
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        void getLocationHistory(
            deviceId,
            toApiDate(nextRange.from),
            toApiDate(nextRange.to),
            timeZone,
            page,
            LOCATION_HISTORY_PAGE_SIZE
        );
        if (page === 1 || rangeChanged) {
            void getLocationRoute(
                deviceId,
                toApiDate(nextRange.from),
                toApiDate(nextRange.to),
                timeZone
            );
        }
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
    const rangeTo = new Date(range.to).getTime();
    const includesPresent = rangeTo + 60_000 >= Date.now();
    const isLatestOnline = latest
        ? Date.now() - new Date(latest.recorded_at).getTime() <=
          LIVE_STALE_THRESHOLD_MS
        : false;
    const offlineStatus: DeviceStatus = {
        key: 'offline',
        label: t.offline,
        dot: 'danger',
    };
    const status: DeviceStatus | null = device
        ? includesPresent && isLatestOnline
            ? { key: 'online', label: t.online, dot: 'success' }
            : offlineStatus
        : null;
    const routePoints = route?.items ?? history;
    const latestTime = latest
        ? new Date(latest.recorded_at).getTime()
        : Number.NaN;
    const rangeFrom = new Date(range.from).getTime();
    const latestInRange =
        includesPresent &&
        Number.isFinite(latestTime) &&
        latestTime >= rangeFrom &&
        latestTime <= rangeTo + 60_000;
    const routePath = detectiveMode
        ? [...routePoints, ...(latestInRange ? liveRoutePoints : [])]
        : liveRoutePoints;
    const routeSegments =
        routeStyle === 'dots'
            ? routePath.length > 0
                ? [routePath]
                : []
            : routePath.length > 1
              ? splitLocationRoute(routePath)
              : [];
    const historicalLocation = route?.items.at(-1) ?? history[0] ?? null;
    const historicalDisplayLocation = historicalLocation
        ? {
              ...historicalLocation,
              battery_voltage: null,
              signal_strength: null,
          }
        : null;
    const displayLocation = includesPresent
        ? (latest ?? historicalDisplayLocation)
        : historicalDisplayLocation;
    const locationError = latestError ?? historyError ?? routeError;
    const routeWindowLabel = t.live.routeWindow
        .replace('{from}', formatHistoryTime(range.from, locale))
        .replace('{to}', formatHistoryTime(range.to, locale));
    const retryLocations = (): void => {
        if (latestError && deviceId) void getLatestLocation(deviceId);
        if (historyError || routeError) loadHistory(range);
    };

    /**
     * Render the loading state
     */
    if (deviceId === undefined || deviceLoading)
        return (
            <div className="live-loading" role="status">
                {t.live.loading}
            </div>
        );
    /**
     * If no deviceId is provided, show an empty state
     */
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
    /**
     * If there is an error loading the device, show an error message
     */
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

    /**
     * Render the Live Tracking page
     */
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
                    onRetry={retryLocations}
                    retryLabel={t.live.retry}
                />
            )}
            {/* KPI Cards */}
            <KpiStrip
                device={device}
                location={displayLocation}
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
                    <div className="live-mode-controls">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                                setDetectiveMode(value => !value);
                                setLiveRoutePoints([]);
                            }}
                            aria-pressed={detectiveMode}
                        >
                            {t.live.detectiveModeLabel}
                        </Button>
                        <Badge tone={detectiveMode ? 'success' : 'neutral'} dot>
                            {detectiveMode ? t.live.on : t.live.off}
                        </Badge>
                        <label className="live-route-style">
                            <span>{t.live.routeStyle}</span>
                            <select
                                value={routeStyle}
                                onChange={event =>
                                    setRouteStyle(
                                        event.target.value as 'line' | 'dots'
                                    )
                                }
                            >
                                <option value="line">{t.live.routeLine}</option>
                                <option value="dots">{t.live.routeDots}</option>
                            </select>
                        </label>
                    </div>
                    <span className="live-available">
                        <Route size={13} />
                        {historyPagination?.total ?? 0} {t.live.pointsAvailable}
                    </span>
                </div>
                {detectiveMode && (
                    <div className="live-card live-detective">
                        <form
                            className="live-form"
                            onSubmit={handleHistorySubmit}
                        >
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
                                loading={historyLoading || routeLoading}
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
                                    onClick={() =>
                                        loadHistory(getDateRange(kind))
                                    }
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
                )}
            </section>

            {/* GPS Telemetry Section */}
            <GpsTelemetrySection
                title={t.detail.gpsTelemetry}
                description={routeWindowLabel}
                latest={displayLocation}
                locale={locale}
                translations={t}
                date={date}
                loading={latestLoading}
                deviceId={deviceId}
                getLatestLocation={getLatestLocation}
                routeSegments={routeSegments}
                routeStyle={routeStyle}
                displayStatus={status}
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
                                {historyLoading
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
