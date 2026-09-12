import '@/styles/reports.css';
import { useState, type JSX, type ReactNode } from 'react';
import { Download, Info, Activity } from 'lucide-react';
import type { Translation } from '@/i18n';
import type { Language } from '@/types';
import { Button } from '@/components/react/ui/button';

interface ReportsPageProps {
    locale: Language;
    translations: Translation['page']['reports'];
}

type ReportsTranslations = Translation['page']['reports'];
type ReportStatus = 'good' | 'review' | 'insufficient';

interface DeviceReport {
    name: string;
    id: string;
    type: string;
    points: string;
    distance: string;
    first: string;
    last: string;
    status: ReportStatus;
}

interface RouteReport {
    name: string;
    id: string;
    time: string;
    duration: string;
    distance: string;
    points: string;
    interruption: boolean;
}

const DEVICES: DeviceReport[] = [
    {
        name: 'Van Madrid-01',
        id: 'IMEI ··· 4521',
        type: 'Van',
        points: '1,284',
        distance: '342.8 km',
        first: '08:14',
        last: '14:32',
        status: 'good',
    },
    {
        name: 'Truck BCN-04',
        id: 'IMEI ··· 9087',
        type: 'Truck',
        points: '982',
        distance: '287.4 km',
        first: '08:03',
        last: '14:28',
        status: 'review',
    },
    {
        name: 'Moto Malaga-02',
        id: 'IMEI ··· 1134',
        type: 'Motorcycle',
        points: '—',
        distance: '—',
        first: '—',
        last: '—',
        status: 'insufficient',
    },
];

const ROUTES: RouteReport[] = [
    {
        name: 'Van Madrid-01',
        id: '···4521',
        time: '09:12 — 11:48',
        duration: '2 h 36 min',
        distance: '86.4 km',
        points: '412',
        interruption: true,
    },
    {
        name: 'Truck BCN-04',
        id: '···9087',
        time: '10:04 — 12:16',
        duration: '2 h 12 min',
        distance: '61.7 km',
        points: '308',
        interruption: false,
    },
    {
        name: 'Van Madrid-01',
        id: '···4521',
        time: '12:02 — 14:32',
        duration: '2 h 30 min',
        distance: '74.1 km',
        points: '378',
        interruption: false,
    },
];

const PERIODS = [
    'lastHour',
    'lastSixHours',
    'lastDay',
    'lastWeek',
    'custom',
] as const;
const STATUS_LABELS: Record<ReportStatus, keyof ReportsTranslations['status']> =
    {
        good: 'good',
        review: 'review',
        insufficient: 'insufficient',
    };

function StatusBadge({
    status,
    labels,
}: {
    status: ReportStatus;
    labels: ReportsTranslations['status'];
}): JSX.Element {
    return (
        <span className={`reports-status reports-status--${status}`}>
            <span />
            {labels[STATUS_LABELS[status]]}
        </span>
    );
}

function ReportCard({
    title,
    description,
    children,
    className = '',
}: {
    title: string;
    description: string;
    children: ReactNode;
    className?: string;
}): JSX.Element {
    return (
        <section className={`reports-card ${className}`}>
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

function Filters({
    t,
    onRefresh,
}: {
    t: ReportsTranslations;
    onRefresh: () => void;
}): JSX.Element {
    const [period, setPeriod] =
        useState<(typeof PERIODS)[number]>('lastSixHours');
    const [hasError, setHasError] = useState(false);
    const periodLabels: Record<(typeof PERIODS)[number], string> = {
        lastHour: t.filters.lastHour,
        lastSixHours: t.filters.lastSixHours,
        lastDay: t.filters.lastDay,
        lastWeek: t.filters.lastWeek,
        custom: t.filters.custom,
    };
    const submit = (): void => {
        if (period === 'custom') {
            setHasError(true);
            return;
        }
        setHasError(false);
        onRefresh();
    };
    return (
        <section className="reports-card reports-filters">
            <div className="reports-filters__grid">
                <label className="reports-field">
                    {t.filters.period}
                    <select
                        value={period}
                        onChange={event => {
                            setPeriod(
                                event.target.value as (typeof PERIODS)[number]
                            );
                            setHasError(false);
                        }}
                    >
                        {PERIODS.map(value => (
                            <option key={value} value={value}>
                                {periodLabels[value]}
                            </option>
                        ))}
                    </select>
                </label>
                {period === 'custom' ? (
                    <div className="reports-date-fields">
                        <label className="reports-field">
                            {t.filters.period}
                            <input
                                type="datetime-local"
                                defaultValue="2026-09-11T08:00"
                            />
                        </label>
                        <label className="reports-field">
                            {t.filters.period}
                            <input
                                type="datetime-local"
                                defaultValue="2026-09-11T14:32"
                            />
                        </label>
                    </div>
                ) : (
                    <label className="reports-field">
                        {t.filters.timezone}
                        <select defaultValue="Europe/Madrid">
                            <option>Europe/Madrid — Madrid</option>
                            <option>America/Mexico_City — Mexico City</option>
                            <option>America/Bogota — Bogotá</option>
                        </select>
                        <small>{t.filters.timezoneHint}</small>
                    </label>
                )}
                <label className="reports-field">
                    {t.filters.devices}
                    <select defaultValue="selected">
                        <option value="selected">
                            {t.filters.selectedDevices}
                        </option>
                        <option>{t.filters.allDevices}</option>
                    </select>
                    <small>{t.filters.deviceHint}</small>
                </label>
                <label className="reports-field">
                    {t.filters.vehicleType}
                    <select defaultValue="all">
                        <option value="all">{t.filters.allVehicleTypes}</option>
                        <option>Van</option>
                        <option>Truck</option>
                        <option>Motorcycle</option>
                    </select>
                </label>
                <Button variant="primary" onClick={submit}>
                    {t.refresh}
                </Button>
            </div>
            {hasError && (
                <div className="reports-validation" role="alert">
                    {t.filters.invalidDate}
                </div>
            )}
            <footer className="reports-filters__footer">
                <span>
                    <Info size={14} />
                    {t.filters.retentionNote}
                </span>
                <span className="reports-mono">
                    {t.filters.lastUpdated} · 14:32:08
                </span>
            </footer>
        </section>
    );
}

function Overview({ t }: { t: ReportsTranslations }): JSX.Element {
    const kpis = [
        ['Devices with activity', '2', 'devices'],
        ['Received points', '2,266', 'points'],
        ['Estimated distance', '630.2', 'km'],
        ['Last report', '14:32', 'local time'],
        ['Most active', 'Van Madrid-01', '1,284 points'],
        ['Largest interruption', '18', 'minutes'],
    ];
    return (
        <ReportCard
            title={t.overview.title}
            description={t.overview.description}
        >
            <div className="reports-kpis">
                {kpis.map(([label, value, hint]) => (
                    <div className="reports-kpi" key={label}>
                        <span>{label}</span>
                        <strong>
                            {value} <small>{hint}</small>
                        </strong>
                        <em>{t.filters.lastSixHours}</em>
                    </div>
                ))}
            </div>
            <div className="reports-card__body">
                <div className="reports-section-heading">
                    <div>
                        <h3>{t.overview.activityTitle}</h3>
                        <p>{t.overview.activityDescription}</p>
                    </div>
                    <span className="reports-mono">
                        {t.overview.receivedPoints}
                    </span>
                </div>
                <div className="reports-chart-layout">
                    <div>
                        <div className="reports-legend">
                            <span>
                                <i />
                                Van Madrid-01
                            </span>
                            <span>
                                <i className="reports-legend__alt" />
                                Truck BCN-04
                            </span>
                        </div>
                        <div
                            className="reports-chart"
                            aria-label={t.overview.activityTitle}
                        >
                            <svg
                                viewBox="0 0 700 190"
                                preserveAspectRatio="none"
                            >
                                <path
                                    d="M0 164 L110 145 L220 126 L330 88 L440 112 L550 52 L700 30"
                                    fill="none"
                                    stroke="var(--accent)"
                                    strokeWidth="2"
                                />
                                <path
                                    d="M0 178 L110 168 L220 149 L330 131 L440 146 L550 108 L700 94"
                                    fill="none"
                                    stroke="var(--success)"
                                    strokeWidth="2"
                                    strokeDasharray="4 4"
                                />
                            </svg>
                        </div>
                        <div className="reports-chart__axis">
                            <span>08:00</span>
                            <span>10:00</span>
                            <span>12:00</span>
                            <span>14:00</span>
                        </div>
                    </div>
                    <aside className="reports-chart-summary">
                        <h3>{t.overview.quickRead}</h3>
                        <p>
                            {t.overview.peakActivity}
                            <strong>13:00</strong>
                        </p>
                        <p>
                            {t.overview.totalPerHour}
                            <strong>377</strong>
                        </p>
                        <p>
                            {t.overview.activeDevices}
                            <strong>2 / 3</strong>
                        </p>
                    </aside>
                </div>
            </div>
            <div className="reports-card__body reports-card__body--border">
                <div className="reports-section-heading">
                    <div>
                        <h3>{t.overview.devicesWithActivity}</h3>
                        <p>{t.overview.devicesDescription}</p>
                    </div>
                    <Button variant="ghost" size="sm">
                        {t.overview.viewAll}
                    </Button>
                </div>
                <div className="reports-table-wrap">
                    <table className="reports-table">
                        <thead>
                            <tr>
                                {[
                                    t.overview.device,
                                    t.overview.vehicle,
                                    t.overview.points,
                                    t.overview.distance,
                                    t.overview.firstReport,
                                    t.overview.lastReport,
                                    t.overview.continuity,
                                ].map(label => (
                                    <th key={label}>{label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {DEVICES.map(device => (
                                <tr key={device.name}>
                                    <td>
                                        <strong>{device.name}</strong>
                                        <small>{device.id}</small>
                                    </td>
                                    <td>{device.type}</td>
                                    <td className="reports-mono">
                                        {device.points}
                                    </td>
                                    <td className="reports-mono">
                                        {device.distance}
                                    </td>
                                    <td className="reports-mono">
                                        {device.first}
                                    </td>
                                    <td className="reports-mono">
                                        {device.last}
                                    </td>
                                    <td>
                                        <StatusBadge
                                            status={device.status}
                                            labels={t.status}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </ReportCard>
    );
}

function Routes({ t }: { t: ReportsTranslations }): JSX.Element {
    const [selected, setSelected] = useState(0);
    const route = ROUTES[selected];
    return (
        <ReportCard
            title={t.routes.title}
            description={t.routes.description}
            className="reports-routes"
        >
            <div className="reports-card__body">
                <div className="reports-disclaimer">
                    <Info size={14} />
                    {t.routes.disclaimer}
                </div>
                <div className="reports-route-grid">
                    <div className="reports-route-list">
                        {ROUTES.map((item, index) => (
                            <button
                                className={
                                    selected === index ? 'is-selected' : ''
                                }
                                key={`${item.name}-${item.time}`}
                                onClick={() => setSelected(index)}
                            >
                                <span>
                                    <strong>{item.name}</strong>
                                    <small>
                                        {item.id} · {item.time}
                                    </small>
                                </span>
                                <span>
                                    {item.duration}
                                    <small>{item.distance}</small>
                                </span>
                                <span>{item.points} pts</span>
                                <b>{t.routes.viewRoute}</b>
                            </button>
                        ))}
                    </div>
                    <div className="reports-route-detail">
                        <div className="reports-detail-heading">
                            <div>
                                <h3>{route.name}</h3>
                                <small>
                                    {t.routes.selectedRoute} · {route.time}
                                </small>
                            </div>
                            <StatusBadge status="good" labels={t.status} />
                        </div>
                        <div className="reports-map">
                            <span className="reports-map__line" />
                            <span className="reports-map__marker reports-map__marker--start" />
                            <span className="reports-map__marker reports-map__marker--end" />
                        </div>
                        <div className="reports-detail-grid">
                            {[
                                [t.routes.duration, route.duration],
                                [t.routes.distance, route.distance],
                                [t.routes.averageSpeed, '32.6 km/h'],
                                [t.routes.maximumSpeed, '78.4 km/h'],
                                [t.routes.routePoints, route.points],
                                [t.routes.coordinates, '40.4168, -3.7038'],
                            ].map(([label, value]) => (
                                <p key={label}>
                                    <small>{label}</small>
                                    <strong>{value}</strong>
                                </p>
                            ))}
                        </div>
                        <div className="reports-notice">
                            {t.routes.simplified}
                        </div>
                        {route.interruption && (
                            <div className="reports-notice reports-notice--warning">
                                {t.routes.interruption}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ReportCard>
    );
}

function Health({ t }: { t: ReportsTranslations }): JSX.Element {
    const [metric, setMetric] = useState<'battery' | 'signal' | 'gps'>(
        'battery'
    );
    const metrics = [
        ['12.4 V', '12.6 V', '22 CSQ', '8 m', '1,284'],
        ['11.9 V', '12.1 V', '15 CSQ', '14 m', '982'],
        ['—', '—', '—', '—', '—'],
    ];
    const metricLabels = {
        battery: t.health.batteryMetric,
        signal: t.health.signalMetric,
        gps: t.health.gpsMetric,
    };
    return (
        <ReportCard title={t.health.title} description={t.health.description}>
            <div className="reports-card__body">
                <div className="reports-health-grid">
                    {DEVICES.map((device, index) => (
                        <article
                            className="reports-health-card"
                            key={device.name}
                        >
                            <header>
                                <strong>{device.name}</strong>
                                <small>
                                    {index === 2
                                        ? t.health.noOptionalTelemetry
                                        : t.health.recentContact}
                                </small>
                                <StatusBadge
                                    status={
                                        index === 2 ? 'insufficient' : 'good'
                                    }
                                    labels={t.status}
                                />
                            </header>
                            <div className="reports-health-metrics">
                                {[
                                    [
                                        t.health.lastContact,
                                        index === 2 ? '—' : device.last,
                                    ],
                                    [
                                        t.health.battery,
                                        metrics[index]?.[0] ?? '—',
                                    ],
                                    [
                                        t.health.averageBattery,
                                        metrics[index]?.[1] ?? '—',
                                    ],
                                    [
                                        t.health.signal,
                                        metrics[index]?.[2] ?? '—',
                                    ],
                                    [
                                        t.health.gpsAccuracy,
                                        metrics[index]?.[3] ?? '—',
                                    ],
                                    [
                                        t.health.reports,
                                        metrics[index]?.[4] ?? '—',
                                    ],
                                ].map(([label, value]) => (
                                    <p key={label}>
                                        <small>{label}</small>
                                        <strong
                                            className={
                                                index === 2
                                                    ? 'reports-no-data'
                                                    : ''
                                            }
                                        >
                                            {value}
                                        </strong>
                                    </p>
                                ))}
                            </div>
                        </article>
                    ))}
                </div>
            </div>
            <div className="reports-card__body reports-card__body--border">
                <div className="reports-section-heading">
                    <div>
                        <h3>{t.health.telemetryTrend}</h3>
                        <p>{t.health.trendDescription}</p>
                    </div>
                    <div className="reports-metric-switch">
                        {(['battery', 'signal', 'gps'] as const).map(value => (
                            <button
                                className={metric === value ? 'is-active' : ''}
                                key={value}
                                onClick={() => setMetric(value)}
                            >
                                {metricLabels[value]}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="reports-trend-layout">
                    <div>
                        <div className="reports-trend">
                            <svg
                                viewBox="0 0 760 150"
                                preserveAspectRatio="none"
                            >
                                <path
                                    d="M0 98 L95 72 L190 81 L285 42 L380 58 M475 92 L570 76 L665 34 L760 50"
                                    fill="none"
                                    stroke="var(--accent)"
                                    strokeWidth="2"
                                />
                            </svg>
                        </div>
                        <div className="reports-trend__meta">
                            <span>08:00</span>
                            <span>{metricLabels[metric]}</span>
                            <span>14:00</span>
                        </div>
                    </div>
                    <div className="reports-empty">
                        <strong>{t.health.trendReading}</strong>
                        {t.health.trendSummary}
                    </div>
                </div>
            </div>
        </ReportCard>
    );
}

function Quality({ t }: { t: ReportsTranslations }): JSX.Element {
    const summary = [
        [t.quality.averageInterval, '32 s', t.quality.period],
        [t.quality.largestInterruption, '18 min', 'Truck BCN-04'],
        [t.quality.incompleteRecords, '6.2%', t.quality.optionalMissing],
        [t.quality.coordinateJumps, '3', t.quality.requiresReview],
    ];
    return (
        <ReportCard title={t.quality.title} description={t.quality.description}>
            <div className="reports-card__body">
                <div className="reports-quality-grid">
                    {summary.map(([label, value, hint]) => (
                        <p key={label}>
                            <span>{label}</span>
                            <strong>{value}</strong>
                            <small>{hint}</small>
                        </p>
                    ))}
                </div>
                <div className="reports-disclaimer reports-disclaimer--wide">
                    <Info size={14} />
                    {t.quality.continuityDisclaimer}
                </div>
                <div className="reports-table-wrap reports-quality-table">
                    <table className="reports-table">
                        <thead>
                            <tr>
                                <th>{t.overview.device}</th>
                                <th>{t.overview.points}</th>
                                <th>{t.quality.averageInterval}</th>
                                <th>{t.quality.largestInterruption}</th>
                                <th>{t.quality.incompleteRecords}</th>
                                <th>{t.quality.quality}</th>
                                <th>{t.quality.state}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {DEVICES.map((device, index) => (
                                <tr key={device.name}>
                                    <td>
                                        <strong>{device.name}</strong>
                                        <small>{device.id}</small>
                                    </td>
                                    <td className="reports-mono">
                                        {device.points}
                                    </td>
                                    <td className="reports-mono">
                                        {index === 0
                                            ? '32 s'
                                            : index === 1
                                              ? '41 s'
                                              : '—'}
                                    </td>
                                    <td className="reports-mono">
                                        {index === 0
                                            ? '4 min'
                                            : index === 1
                                              ? '18 min'
                                              : '—'}
                                    </td>
                                    <td className="reports-mono">
                                        {index === 0
                                            ? '98.4%'
                                            : index === 1
                                              ? '91.7%'
                                              : '—'}
                                    </td>
                                    <td>
                                        {index === 0
                                            ? t.status.good
                                            : index === 1
                                              ? t.status.review
                                              : t.status.insufficient}
                                    </td>
                                    <td>
                                        <StatusBadge
                                            status={device.status}
                                            labels={t.status}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </ReportCard>
    );
}

function ExportBar({ t }: { t: ReportsTranslations }): JSX.Element {
    const [message, setMessage] = useState('');
    const exportReport = (format: 'CSV' | 'GPX'): void => {
        setMessage(t.export.preparing.replace('{type}', format));
        window.setTimeout(() => setMessage(t.export.ready), 900);
    };
    return (
        <section className="reports-export">
            <div>
                <strong>{t.export.title}</strong>
                <p>{message || t.export.description}</p>
            </div>
            <div>
                <Button
                    variant="secondary"
                    icon={<Download size={14} />}
                    onClick={() => exportReport('CSV')}
                >
                    {t.export.csv}
                </Button>
                <Button
                    variant="secondary"
                    icon={<Download size={14} />}
                    onClick={() => exportReport('GPX')}
                >
                    {t.export.gpx}
                </Button>
            </div>
        </section>
    );
}

/**
 * Reports page design preview. Data and actions are intentionally local until the reporting API is defined.
 * @param props - Locale and translated labels used by the feature.
 * @returns The reports page island.
 */
export function ReportsPage({
    locale: _locale,
    translations: t,
}: ReportsPageProps): JSX.Element {
    const [updated, setUpdated] = useState(false);
    const refresh = (): void => {
        setUpdated(true);
        window.setTimeout(() => setUpdated(false), 2600);
    };
    return (
        <div className="reports-page">
            <header className="reports-page__header">
                <div>
                    <span className="reports-eyebrow">{t.eyebrow}</span>
                    <h1>{t.title}</h1>
                    <p>{t.subtitle}</p>
                </div>
                <Button variant="secondary" onClick={() => setUpdated(true)}>
                    {t.changeFilters}
                </Button>
            </header>
            <div className="reports-stack">
                <Filters t={t} onRefresh={refresh} />
                <Overview t={t} />
                <Routes t={t} />
                <Health t={t} />
                <Quality t={t} />
                <ExportBar t={t} />
            </div>
            {updated && (
                <div className="reports-toast" role="status">
                    <Activity size={14} />
                    {t.updated}
                </div>
            )}
        </div>
    );
}
