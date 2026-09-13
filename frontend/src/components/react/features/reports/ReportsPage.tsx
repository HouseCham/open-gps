import '@/styles/reports.css';
import { Download, Info, RefreshCw } from 'lucide-react';
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type JSX,
    type ReactNode,
} from 'react';

import { Button } from '@/components/react/ui/button';
import { apiClient } from '@/lib/api/client';
import { reportsService } from '@/lib/api/services/reportsService';
import type { Translation } from '@/i18n';
import type {
    DeviceListResponse,
    DeviceVehicleType,
    Envelope,
    DeviceWithAccess,
} from '@/types/api';
import type {
    HealthReport,
    OverviewReport,
    QualityReport,
    ReportFilter,
    RoutesReport,
} from '@/types/api/reports.types';

interface ReportsPageProps {
    translations: Translation['page']['reports'];
}

interface SectionState<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
}

type Period = 'lastHour' | 'lastSixHours' | 'lastDay' | 'lastWeek' | 'custom';

const PERIODS: Period[] = [
    'lastHour',
    'lastSixHours',
    'lastDay',
    'lastWeek',
    'custom',
];
const VEHICLE_TYPES: DeviceVehicleType[] = [
    'bicycle',
    'motorcycle',
    'car',
    'truck',
    'van',
    'other',
];
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

function isPeriod(value: string): value is Period {
    switch (value) {
        case 'lastHour':
        case 'lastSixHours':
        case 'lastDay':
        case 'lastWeek':
        case 'custom':
            return true;
        default:
            return false;
    }
}

function isVehicleType(value: string): value is DeviceVehicleType {
    switch (value) {
        case 'bicycle':
        case 'motorcycle':
        case 'car':
        case 'truck':
        case 'van':
        case 'other':
            return true;
        default:
            return false;
    }
}

function pad(value: number): string {
    return String(value).padStart(2, '0');
}

function localInput(date: Date): string {
    return [
        date.getFullYear(),
        '-',
        pad(date.getMonth() + 1),
        '-',
        pad(date.getDate()),
        'T',
        pad(date.getHours()),
        ':',
        pad(date.getMinutes()),
    ].join('');
}

function initialRange(): { from: string; to: string } {
    const to = new Date();
    const from = new Date(to.getTime() - 6 * 60 * 60 * 1000);
    return { from: localInput(from), to: localInput(to) };
}

function apiDate(value: string): string {
    return value.length === 16 ? `${value}:00` : value;
}

function formatNumber(value: number, digits = 1): string {
    return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: digits,
    }).format(value);
}

function formatMetric(
    value: number | null | undefined,
    unit: string,
    digits = 1
): string {
    return value == null ? '—' : `${formatNumber(value, digits)} ${unit}`;
}

function formatDate(value: string | null | undefined): string {
    return value ? new Date(value).toLocaleString() : '—';
}

function sectionState<T>(): SectionState<T> {
    return { data: null, loading: true, error: null };
}

interface SectionProps<T> {
    state: SectionState<T>;
    title: string;
    description: string;
    retry: () => void;
    children: (data: T) => JSX.Element;
    translations: ReportsPageProps['translations'];
}

function Card({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: ReactNode;
}): JSX.Element {
    return (
        <section className="reports-card">
            <header className="reports-card__header">
                <div>
                    <h2>{title}</h2>
                    <p>{description}</p>
                </div>
            </header>
            {children}
        </section>
    );
}

function LoadingState({ label }: { label: string }): JSX.Element {
    return (
        <div className="reports-empty" aria-busy="true">
            {label}
        </div>
    );
}

function ErrorState({
    message,
    retry,
    label,
}: {
    message: string;
    retry: () => void;
    label: string;
}): JSX.Element {
    return (
        <div className="reports-empty" role="alert">
            <p>{message}</p>
            <Button variant="ghost" size="sm" onClick={retry}>
                <RefreshCw size={14} />
                {label}
            </Button>
        </div>
    );
}

function ReportSection<T>({
    state,
    title,
    description,
    retry,
    children,
    translations: t,
}: SectionProps<T>): JSX.Element {
    if (state.loading) {
        return (
            <Card title={title} description={description}>
                <LoadingState label={t.loading} />
            </Card>
        );
    }

    if (state.error || !state.data) {
        return (
            <Card title={title} description={description}>
                <ErrorState
                    message={state.error ?? t.noData}
                    retry={retry}
                    label={t.retry}
                />
            </Card>
        );
    }

    return (
        <Card title={title} description={description}>
            {children(state.data)}
        </Card>
    );
}

export function ReportsPage({
    translations: t,
}: ReportsPageProps): JSX.Element {
    const range = useMemo(initialRange, []);
    const [period, setPeriod] = useState<Period>('lastSixHours');
    const [from, setFrom] = useState(range.from);
    const [to, setTo] = useState(range.to);
    const [deviceIds, setDeviceIds] = useState<string[]>([]);
    const [vehicleType, setVehicleType] = useState<DeviceVehicleType | ''>('');
    const [devices, setDevices] = useState<DeviceWithAccess[]>([]);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [overview, setOverview] =
        useState<SectionState<OverviewReport>>(sectionState);
    const [routes, setRoutes] =
        useState<SectionState<RoutesReport>>(sectionState);
    const [health, setHealth] =
        useState<SectionState<HealthReport>>(sectionState);
    const [quality, setQuality] =
        useState<SectionState<QualityReport>>(sectionState);

    const filter = useMemo<ReportFilter>(
        () => ({
            from: apiDate(from),
            to: apiDate(to),
            timeZone: TIME_ZONE,
            deviceIds,
            vehicleType: vehicleType || undefined,
        }),
        [deviceIds, from, to, vehicleType]
    );

    const loadSection = useCallback(
        async <T,>(
            request: Promise<T>,
            update: (state: SectionState<T>) => void
        ): Promise<void> => {
            try {
                update({ data: await request, loading: false, error: null });
            } catch (error: unknown) {
                const message =
                    error instanceof Error ? error.message : t.loadError;
                update({ data: null, loading: false, error: message });
            }
        },
        [t.loadError]
    );

    const load = useCallback(
        async (current: ReportFilter): Promise<void> => {
            setOverview({ data: null, loading: true, error: null });
            setRoutes({ data: null, loading: true, error: null });
            setHealth({ data: null, loading: true, error: null });
            setQuality({ data: null, loading: true, error: null });
            await Promise.all([
                loadSection(reportsService.overview(current), setOverview),
                loadSection(reportsService.routes(current), setRoutes),
                loadSection(reportsService.health(current), setHealth),
                loadSection(reportsService.quality(current), setQuality),
            ]);
        },
        [loadSection]
    );

    useEffect(() => {
        void apiClient<Envelope<DeviceListResponse>>('/devices', {
            method: 'GET',
            query: { page: 1, page_size: 100 },
        })
            .then(result => setDevices(result.data?.data.items ?? []))
            .catch(() => setDevices([]));
    }, []);

    useEffect(() => {
        void load(filter);
    }, [filter, load, refreshKey]);

    function applyPeriod(value: Period): void {
        setPeriod(value);
        if (value === 'custom') {
            return;
        }

        const end = new Date();
        const hours = {
            lastHour: 1,
            lastSixHours: 6,
            lastDay: 24,
            lastWeek: 168,
        }[value];
        setFrom(localInput(new Date(end.getTime() - hours * 60 * 60 * 1000)));
        setTo(localInput(end));
    }

    function refresh(): void {
        if (new Date(from) >= new Date(to)) {
            setValidationError(t.filters.invalidDate);
            return;
        }
        setValidationError(null);
        setRefreshKey(value => value + 1);
    }

    function toggleDevice(id: string): void {
        setDeviceIds(current =>
            current.includes(id)
                ? current.filter(value => value !== id)
                : [...current, id]
        );
    }

    const retry = (): void => setRefreshKey(value => value + 1);

    return (
        <div className="reports-page">
            <header className="reports-page__header">
                <div>
                    <span className="reports-eyebrow">{t.eyebrow}</span>
                    <h1>{t.title}</h1>
                    <p>{t.subtitle}</p>
                </div>
            </header>
            <div className="reports-stack">
                <Filters
                    devices={devices}
                    deviceIds={deviceIds}
                    from={from}
                    period={period}
                    to={to}
                    validationError={validationError}
                    vehicleType={vehicleType}
                    translations={t}
                    onApplyPeriod={applyPeriod}
                    onDeviceToggle={toggleDevice}
                    onFromChange={value => {
                        setPeriod('custom');
                        setFrom(value);
                    }}
                    onRefresh={refresh}
                    onToChange={value => {
                        setPeriod('custom');
                        setTo(value);
                    }}
                    onVehicleTypeChange={setVehicleType}
                />
                <ReportSection
                    state={overview}
                    title={t.overview.title}
                    description={t.overview.description}
                    retry={retry}
                    translations={t}
                >
                    {data => <OverviewContent data={data} translations={t} />}
                </ReportSection>
                <ReportSection
                    state={routes}
                    title={t.routes.title}
                    description={t.routes.description}
                    retry={retry}
                    translations={t}
                >
                    {data => <RoutesContent data={data} translations={t} />}
                </ReportSection>
                <ReportSection
                    state={health}
                    title={t.health.title}
                    description={t.health.description}
                    retry={retry}
                    translations={t}
                >
                    {data => <HealthContent data={data} translations={t} />}
                </ReportSection>
                <ReportSection
                    state={quality}
                    title={t.quality.title}
                    description={t.quality.description}
                    retry={retry}
                    translations={t}
                >
                    {data => <QualityContent data={data} translations={t} />}
                </ReportSection>
                <ExportActions filter={filter} translations={t} />
            </div>
        </div>
    );
}

interface FiltersProps {
    devices: DeviceWithAccess[];
    deviceIds: string[];
    from: string;
    period: Period;
    to: string;
    validationError: string | null;
    vehicleType: DeviceVehicleType | '';
    translations: ReportsPageProps['translations'];
    onApplyPeriod: (period: Period) => void;
    onDeviceToggle: (id: string) => void;
    onFromChange: (value: string) => void;
    onRefresh: () => void;
    onToChange: (value: string) => void;
    onVehicleTypeChange: (value: DeviceVehicleType | '') => void;
}

function Filters({
    devices,
    deviceIds,
    from,
    period,
    to,
    validationError,
    vehicleType,
    translations: t,
    onApplyPeriod,
    onDeviceToggle,
    onFromChange,
    onRefresh,
    onToChange,
    onVehicleTypeChange,
}: FiltersProps): JSX.Element {
    return (
        <section className="reports-card reports-filters">
            <div className="reports-filters__grid">
                <label className="reports-field">
                    {t.filters.period}
                    <select
                        value={period}
                        onChange={event => {
                            if (isPeriod(event.target.value))
                                onApplyPeriod(event.target.value);
                        }}
                    >
                        {PERIODS.map(value => (
                            <option key={value} value={value}>
                                {t.filters[value]}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="reports-field">
                    {t.filters.timezone}
                    <input value={TIME_ZONE} readOnly />
                    <small>{t.filters.timezoneHint}</small>
                </label>
                <label className="reports-field">
                    {t.filters.from}
                    <input
                        type="datetime-local"
                        value={from}
                        onChange={event => onFromChange(event.target.value)}
                    />
                </label>
                <label className="reports-field">
                    {t.filters.to}
                    <input
                        type="datetime-local"
                        value={to}
                        onChange={event => onToChange(event.target.value)}
                    />
                </label>
                <label className="reports-field">
                    {t.filters.vehicleType}
                    <select
                        value={vehicleType}
                        onChange={event =>
                            onVehicleTypeChange(
                                isVehicleType(event.target.value)
                                    ? event.target.value
                                    : ''
                            )
                        }
                    >
                        <option value="">{t.filters.allVehicleTypes}</option>
                        {VEHICLE_TYPES.map(value => (
                            <option key={value} value={value}>
                                {t.vehicles[value]}
                            </option>
                        ))}
                    </select>
                </label>
                <fieldset className="reports-field">
                    <legend>{t.filters.devices}</legend>
                    <div className="reports-device-options">
                        {devices.map(device => (
                            <label key={device.id}>
                                <input
                                    type="checkbox"
                                    checked={deviceIds.includes(device.id)}
                                    onChange={() => onDeviceToggle(device.id)}
                                />
                                {device.name}
                            </label>
                        ))}
                    </div>
                </fieldset>
                <Button variant="primary" onClick={onRefresh}>
                    <RefreshCw size={14} />
                    {t.refresh}
                </Button>
            </div>
            {validationError && (
                <div className="reports-validation" role="alert">
                    {validationError}
                </div>
            )}
            <footer className="reports-filters__footer">
                <span>
                    <Info size={14} />
                    {t.filters.retentionNote}
                </span>
                <span>
                    {deviceIds.length || devices.length} {t.authorizedDevices}
                </span>
            </footer>
        </section>
    );
}

function OverviewContent({
    data,
    translations: t,
}: {
    data: OverviewReport;
    translations: ReportsPageProps['translations'];
}): JSX.Element {
    return (
        <>
            <div className="reports-kpis">
                <Kpi
                    label={t.kpis.activity}
                    value={String(data.device_count)}
                    unit={t.units.devices}
                />
                <Kpi
                    label={t.kpis.points}
                    value={String(data.point_count)}
                    unit={t.units.points}
                />
                <Kpi
                    label={t.kpis.distance}
                    value={formatMetric(
                        data.estimated_distance_km,
                        t.units.kilometers
                    )}
                    unit={t.estimated}
                />
                <Kpi
                    label={t.kpis.interruption}
                    value={formatMetric(
                        data.longest_gap_seconds / 60,
                        t.units.minutes
                    )}
                    unit={t.longestGap}
                />
            </div>
            <Table>
                <thead>
                    <tr>
                        <th>{t.overview.device}</th>
                        <th>{t.overview.points}</th>
                        <th>{t.overview.distance}</th>
                        <th>{t.overview.firstReport}</th>
                        <th>{t.overview.lastReport}</th>
                    </tr>
                </thead>
                <tbody>
                    {data.devices.map(item => (
                        <tr key={item.device.id}>
                            <td>
                                <strong>{item.device.name}</strong>
                                <small>{item.device.vehicle_type}</small>
                            </td>
                            <td>{item.point_count}</td>
                            <td>
                                {formatMetric(
                                    item.estimated_distance_km,
                                    t.units.kilometers
                                )}
                            </td>
                            <td>{formatDate(item.first_report)}</td>
                            <td>{formatDate(item.latest_report)}</td>
                        </tr>
                    ))}
                </tbody>
            </Table>
        </>
    );
}

function RoutesContent({
    data,
    translations: t,
}: {
    data: RoutesReport;
    translations: ReportsPageProps['translations'];
}): JSX.Element {
    return (
        <>
            <div className="reports-card__body">
                <div className="reports-disclaimer">
                    <Info size={14} />
                    {t.routes.disclaimer}
                </div>
            </div>
            <Table>
                <thead>
                    <tr>
                        <th>{t.overview.device}</th>
                        <th>{t.routes.duration}</th>
                        <th>{t.routes.distance}</th>
                        <th>{t.routes.averageSpeed}</th>
                        <th>{t.routes.routePoints}</th>
                    </tr>
                </thead>
                <tbody>
                    {data.routes.map(route => (
                        <tr key={`${route.device.id}-${route.started_at}`}>
                            <td>{route.device.name}</td>
                            <td>
                                {formatMetric(
                                    route.duration_seconds / 60,
                                    t.units.minutes
                                )}
                            </td>
                            <td>
                                {formatMetric(
                                    route.distance_km,
                                    t.units.kilometers
                                )}
                            </td>
                            <td>
                                {formatMetric(
                                    route.average_speed_kph,
                                    t.units.speed
                                )}
                            </td>
                            <td>
                                {route.complete_point_count}{' '}
                                <small>
                                    ({route.returned_point_count} {t.display})
                                </small>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Table>
        </>
    );
}

function HealthContent({
    data,
    translations: t,
}: {
    data: HealthReport;
    translations: ReportsPageProps['translations'];
}): JSX.Element {
    return (
        <Table>
            <thead>
                <tr>
                    <th>{t.overview.device}</th>
                    <th>{t.health.battery}</th>
                    <th>{t.health.averageBattery}</th>
                    <th>{t.health.signal}</th>
                    <th>{t.health.gpsAccuracy}</th>
                    <th>{t.health.reports}</th>
                </tr>
            </thead>
            <tbody>
                {data.devices.map(device => (
                    <tr key={device.device.id}>
                        <td>{device.device.name}</td>
                        <td>
                            {formatMetric(device.battery_voltage.latest, 'V')}
                        </td>
                        <td>
                            {formatMetric(device.battery_voltage.average, 'V')}
                        </td>
                        <td>
                            {device.signal_strength.latest == null
                                ? '—'
                                : `${device.signal_strength.latest} CSQ`}
                        </td>
                        <td>
                            {formatMetric(device.gps_accuracy.average, 'm')}
                        </td>
                        <td>{device.point_count}</td>
                    </tr>
                ))}
            </tbody>
        </Table>
    );
}

function QualityContent({
    data,
    translations: t,
}: {
    data: QualityReport;
    translations: ReportsPageProps['translations'];
}): JSX.Element {
    return (
        <>
            <div className="reports-card__body">
                <div className="reports-disclaimer">
                    <Info size={14} />
                    {t.quality.continuityDisclaimer}
                </div>
            </div>
            <Table>
                <thead>
                    <tr>
                        <th>{t.overview.device}</th>
                        <th>{t.overview.points}</th>
                        <th>{t.quality.averageInterval}</th>
                        <th>{t.quality.largestInterruption}</th>
                        <th>{t.quality.coordinateJumps}</th>
                    </tr>
                </thead>
                <tbody>
                    {data.devices.map(device => (
                        <tr key={device.device.id}>
                            <td>{device.device.name}</td>
                            <td>{device.point_count}</td>
                            <td>
                                {formatMetric(
                                    device.average_interval_seconds,
                                    's'
                                )}
                            </td>
                            <td>
                                {formatMetric(
                                    device.longest_gap_seconds / 60,
                                    t.units.minutes
                                )}
                            </td>
                            <td>{device.jump_count}</td>
                        </tr>
                    ))}
                </tbody>
            </Table>
        </>
    );
}

function Kpi({
    label,
    value,
    unit,
}: {
    label: string;
    value: string;
    unit: string;
}): JSX.Element {
    return (
        <div className="reports-kpi">
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{unit}</small>
        </div>
    );
}

function Table({ children }: { children: ReactNode }): JSX.Element {
    return (
        <div className="reports-card__body">
            <div className="reports-table-wrap">
                <table className="reports-table">{children}</table>
            </div>
        </div>
    );
}

function ExportActions({
    filter,
    translations: t,
}: {
    filter: ReportFilter;
    translations: ReportsPageProps['translations'];
}): JSX.Element {
    return (
        <section className="reports-export">
            <div>
                <strong>{t.export.title}</strong>
                <p>{t.export.description}</p>
            </div>
            <div>
                <a
                    className="btn btn--secondary"
                    href={reportsService.exportUrl(filter, 'csv')}
                    download
                >
                    <Download size={14} />
                    {t.export.csv}
                </a>
                <a
                    className="btn btn--secondary"
                    href={reportsService.exportUrl(filter, 'gpx')}
                    download
                >
                    <Download size={14} />
                    {t.export.gpx}
                </a>
            </div>
        </section>
    );
}
