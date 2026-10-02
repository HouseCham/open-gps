import '@/styles/live-tracking.css';
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type JSX,
    type SubmitEvent,
} from 'react';
//-- Types
import type { DateRange, Language } from '@/types';
import type { DeviceDetail, LocationPoint } from '@/types/api';
import type { Translation } from '@/i18n';
//-- Constants
import { LOCATION_HISTORY_PAGE_SIZE } from '@/constants/components';
//-- Services
import { useLocationService } from '@/lib/api/services/locationService';
//-- Utils
import {
    downloadCsv,
    formatDateMetric,
    formatHistoryTime,
    getDateRange,
    splitLocationRoute,
    toApiDate,
} from '@/lib';
//-- Components
import { Badge, Pagination } from '@/components/react/ui';
import { Button } from '@/components/react/ui/button';
import { DeviceDetailError } from '@/components/react/features/devices/detail';
//-- Icons
import { Download, Info, RefreshCw, Route } from 'lucide-react';

/**
 * Props for the DeviceHistoryView component
 * @interface DeviceHistoryViewProps
 * @prop {string} deviceId - Device ID.
 * @prop {Language} locale - Locale.
 * @prop {Translation['device']} translations - Translations.
 * @prop {DeviceDetail} device - Device details.
 * @prop {LocationPoint | null} latest - Latest location.
 * @prop {LocationPoint[]} liveRoutePoints - Live route points.
 * @prop {Function} onRouteChange - Callback for route change.
 */
interface DeviceHistoryViewProps {
    deviceId: string;
    locale: Language;
    translations: Translation['device'];
    device: DeviceDetail;
    latest: LocationPoint | null;
    liveRoutePoints: LocationPoint[];
    onRouteChange: (
        segments: LocationPoint[][],
        style: 'line' | 'dots'
    ) => void;
}
/**
 * DeviceHistoryView component displays the location history and route of a device.
 * @param {DeviceHistoryViewProps} props - Component props.
 * @returns {JSX.Element} The rendered component.
 */
export function DeviceHistoryView({
    deviceId,
    locale,
    translations,
    device,
    latest,
    liveRoutePoints,
    onRouteChange,
}: DeviceHistoryViewProps): JSX.Element {
    const t = translations.live;
    const {
        history,
        historyPagination,
        route,
        historyLoading,
        routeLoading,
        historyError,
        routeError,
        getLocationHistory,
        getLocationRoute,
    } = useLocationService();
    const [range, setRange] = useState<DateRange>(() => getDateRange('today'));
    const [detectiveMode, setDetectiveMode] = useState(false);
    const [routeStyle, setRouteStyle] = useState<'line' | 'dots'>('line');

    useEffect(() => {
        const initialRange = getDateRange('today');
        setRange(initialRange);
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        void getLocationHistory(
            deviceId,
            toApiDate(initialRange.from),
            toApiDate(initialRange.to),
            timeZone,
            1,
            LOCATION_HISTORY_PAGE_SIZE
        );
    }, [deviceId, getLocationHistory]);
    /**
     * Load location history for the given date range
     * @param {DateRange} nextRange - The date range to load history for.
     * @param {number} page - The page number to load history for.
     * @returns {void}
     */
    const loadHistory = useCallback(
        (nextRange: DateRange, page = 1): void => {
            const rangeChanged =
                nextRange.from !== range.from || nextRange.to !== range.to;
            setRange(nextRange);
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            void getLocationHistory(
                deviceId,
                toApiDate(nextRange.from),
                toApiDate(nextRange.to),
                timeZone,
                page,
                LOCATION_HISTORY_PAGE_SIZE
            );
            if (detectiveMode && (page === 1 || rangeChanged)) {
                void getLocationRoute(
                    deviceId,
                    toApiDate(nextRange.from),
                    toApiDate(nextRange.to),
                    timeZone
                );
            }
        },
        [
            detectiveMode,
            deviceId,
            getLocationHistory,
            getLocationRoute,
            range.from,
            range.to,
        ]
    );

    const rangeTo = new Date(range.to).getTime();
    const latestTime = latest ? new Date(latest.recorded_at).getTime() : NaN;
    const latestInRange =
        rangeTo + 60_000 >= Date.now() &&
        Number.isFinite(latestTime) &&
        latestTime >= new Date(range.from).getTime() &&
        latestTime <= rangeTo + 60_000;
    const routePoints = route?.items ?? history;
    const routePath = useMemo(() => {
        if (!detectiveMode) return [];
        const from = new Date(range.from).getTime();
        const to = new Date(range.to).getTime();
        const inRangeLivePoints = latestInRange
            ? liveRoutePoints.filter(point => {
                  const time = new Date(point.recorded_at).getTime();
                  return time >= from && time <= to;
              })
            : [];
        return [...routePoints, ...inRangeLivePoints];
    }, [
        detectiveMode,
        latestInRange,
        liveRoutePoints,
        range.from,
        range.to,
        routePoints,
    ]);
    /**
     * Split the route path into segments based on the route style
     * @returns {LocationPoint[][]} The route segments
     */
    const routeSegments = useMemo(() => {
        if (routeStyle === 'dots')
            return routePath.length > 0 ? [routePath] : [];
        return splitLocationRoute(routePath);
    }, [routePath, routeStyle]);

    useEffect(() => {
        onRouteChange(routeSegments, routeStyle);
    }, [onRouteChange, routeSegments, routeStyle]);

    /**
     * Handles the submission of the history form.
     * @param {SubmitEvent<HTMLFormElement>} event - The form submission event.
     * @returns {void}
     */
    const handleHistorySubmit = (event: SubmitEvent<HTMLFormElement>): void => {
        event.preventDefault();
        loadHistory(range);
    };

    /**
     * Handles the toggle of the detective mode.
     * @returns {void}
     */
    const handleDetectiveToggle = (): void => {
        const nextValue = !detectiveMode;
        setDetectiveMode(nextValue);
        if (!nextValue) return;
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        void getLocationRoute(
            deviceId,
            toApiDate(range.from),
            toApiDate(range.to),
            timeZone
        );
    };
    /**
     * Retries loading locations when there is an error
     * @returns {void}
     */
    const retryLocations = (): void => {
        if (historyError) {
            loadHistory(range);
        }
        if (routeError && detectiveMode) {
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            void getLocationRoute(
                deviceId,
                toApiDate(range.from),
                toApiDate(range.to),
                timeZone
            );
        }
    };
    /**
     * Generates the label for the route window based on the selected date range and locale.
     * @returns {string} The formatted route window label.
     */
    const routeWindowLabel = t.routeWindow
        .replace('{from}', formatHistoryTime(range.from, locale))
        .replace('{to}', formatHistoryTime(range.to, locale));

    return (
        <div className="live-history">
            {/* Error Messages */}
            {(historyError || routeError) && (
                <DeviceDetailError
                    message={
                        historyError?.message ??
                        routeError?.message ??
                        t.failedToLoad
                    }
                    onRetry={retryLocations}
                    retryLabel={t.retry}
                />
            )}
            {/* Detective Mode */}
            <section
                className="live-section"
                aria-labelledby="device-route-analysis-title"
            >
                <div className="live-section-head">
                    <div>
                        <h2 id="device-route-analysis-title">
                            {t.detectiveMode}
                        </h2>
                        <p>{t.detectiveDescription}</p>
                    </div>
                    <div className="live-mode-controls">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleDetectiveToggle}
                            aria-pressed={detectiveMode}
                        >
                            {t.detectiveModeLabel}
                        </Button>
                        <Badge tone={detectiveMode ? 'success' : 'neutral'} dot>
                            {detectiveMode ? t.on : t.off}
                        </Badge>
                        {detectiveMode && (
                            <label className="live-route-style">
                                <span>{t.routeStyle}</span>
                                <select
                                    value={routeStyle}
                                    onChange={event => {
                                        const value = event.target.value;
                                        if (
                                            value === 'line' ||
                                            value === 'dots'
                                        ) {
                                            setRouteStyle(value);
                                        }
                                    }}
                                >
                                    <option value="line">{t.routeLine}</option>
                                    <option value="dots">{t.routeDots}</option>
                                </select>
                            </label>
                        )}
                    </div>
                    <span className="live-available" aria-live="polite">
                        <Route size={13} aria-hidden="true" />
                        {historyPagination?.total ?? history.length}{' '}
                        {t.pointsAvailable}
                    </span>
                </div>

                {detectiveMode && (
                    <div className="live-card live-detective">
                        <form
                            className="live-form"
                            onSubmit={handleHistorySubmit}
                        >
                            <label>
                                <span>{t.from}</span>
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
                                <span>{t.to}</span>
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
                                {t.applyWindow}
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
                                    {t.ranges[kind]}
                                </button>
                            ))}
                            <button
                                type="button"
                                className="live-filter"
                                onClick={() =>
                                    document
                                        .querySelector<HTMLInputElement>(
                                            '#device-history-panel input[type="datetime-local"]'
                                        )
                                        ?.focus()
                                }
                            >
                                {t.ranges.custom}
                            </button>
                        </div>
                        <div className="live-note">
                            <Info size={14} aria-hidden="true" />
                            {t.detectiveNote}
                        </div>
                    </div>
                )}
            </section>
            {/* Location history */}
            <section
                className="live-section"
                aria-labelledby="device-location-history-title"
            >
                <div className="live-section-head">
                    <div>
                        <h2 id="device-location-history-title">
                            {t.locationHistory}
                        </h2>
                        <p>{routeWindowLabel}</p>
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={<Download size={14} />}
                        onClick={() => downloadCsv(device, history, t)}
                        disabled={history.length === 0}
                    >
                        {t.export}
                    </Button>
                </div>
                <div className="live-card live-table-card">
                    <div className="live-table-wrap" aria-busy={historyLoading}>
                        <table
                            className="live-table"
                            aria-label={t.locationHistory}
                        >
                            <thead>
                                <tr>
                                    <th>{t.recorded}</th>
                                    <th>{t.coordinates}</th>
                                    <th>{t.speed}</th>
                                    <th>{t.altitude}</th>
                                    <th>{t.accuracy}</th>
                                    <th>{t.source}</th>
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
                                                t.speedUnit
                                            )}
                                        </td>
                                        <td>
                                            {formatDateMetric(
                                                point.altitude,
                                                t.meters
                                            )}
                                        </td>
                                        <td>
                                            {point.accuracy === null ||
                                            point.accuracy === undefined
                                                ? '—'
                                                : `±${point.accuracy.toFixed(1)} ${t.meters}`}
                                        </td>
                                        <td>{t.cellular}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {history.length === 0 && (
                            <div
                                className="live-empty"
                                role="status"
                                aria-live="polite"
                            >
                                {historyLoading
                                    ? t.loadingHistory
                                    : t.noHistory}
                            </div>
                        )}
                    </div>
                    {historyPagination && (
                        <div className="live-table-foot">
                            <span>{t.ingestionInterval}</span>
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
