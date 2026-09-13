import '@/styles/reports.css';

import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
//-- Types
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
import type { Period, ReportsPageProps, SectionState } from '@/types/reports';
//-- Constants
import { REPORT_PERIOD_HOURS, REPORT_TIME_ZONE } from '@/constants/reports';
//-- Utils
import { apiClient } from '@/lib/api/client';
import {
    createReportSectionState,
    formatDateTimeInput,
    formatReportDateForApi,
    getInitialReportRange,
} from '@/lib/reports-utils';
//-- Services
import { reportsService } from '@/lib/api/services/reportsService';
//-- Components
import { HealthSection } from './HealthSection';
import { OverviewSection } from './OverviewSection';
import { QualitySection } from './QualitySection';
import { ReportExport } from './ReportExport';
import { ReportSection } from './ReportSection';
import { ReportsFilters } from './ReportsFilters';
import { RoutesSection } from './RoutesSection';

/** Reports page island that coordinates filters, data loading, and report sections. */
export default function ReportsPage({
    translations: t,
}: ReportsPageProps): JSX.Element {
    const initialRange = useMemo(getInitialReportRange, []);
    const [period, setPeriod] = useState<Period>('lastSixHours');
    const [from, setFrom] = useState(initialRange.from);
    const [to, setTo] = useState(initialRange.to);
    const [deviceIds, setDeviceIds] = useState<string[]>([]);
    const [vehicleType, setVehicleType] = useState<DeviceVehicleType | ''>('');
    const [devices, setDevices] = useState<DeviceWithAccess[]>([]);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [overview, setOverview] = useState<SectionState<OverviewReport>>(() =>
        createReportSectionState()
    );
    const [routes, setRoutes] = useState<SectionState<RoutesReport>>(() =>
        createReportSectionState()
    );
    const [health, setHealth] = useState<SectionState<HealthReport>>(() =>
        createReportSectionState()
    );
    const [quality, setQuality] = useState<SectionState<QualityReport>>(() =>
        createReportSectionState()
    );

    const filter = useMemo<ReportFilter>(
        () => ({
            from: formatReportDateForApi(from),
            to: formatReportDateForApi(to),
            timeZone: REPORT_TIME_ZONE,
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

    const loadReports = useCallback(
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
        void loadReports(filter);
    }, [filter, loadReports, refreshKey]);

    function applyPeriod(value: Period): void {
        setPeriod(value);
        if (value === 'custom') return;

        const end = new Date();
        const hours = REPORT_PERIOD_HOURS[value];
        setFrom(
            formatDateTimeInput(
                new Date(end.getTime() - hours * 60 * 60 * 1000)
            )
        );
        setTo(formatDateTimeInput(end));
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
                <ReportsFilters
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
                    {data => <OverviewSection data={data} translations={t} />}
                </ReportSection>
                <ReportSection
                    state={routes}
                    title={t.routes.title}
                    description={t.routes.description}
                    retry={retry}
                    translations={t}
                >
                    {data => <RoutesSection data={data} translations={t} />}
                </ReportSection>
                <ReportSection
                    state={health}
                    title={t.health.title}
                    description={t.health.description}
                    retry={retry}
                    translations={t}
                >
                    {data => <HealthSection data={data} translations={t} />}
                </ReportSection>
                <ReportSection
                    state={quality}
                    title={t.quality.title}
                    description={t.quality.description}
                    retry={retry}
                    translations={t}
                >
                    {data => <QualitySection data={data} translations={t} />}
                </ReportSection>
                <ReportExport filter={filter} translations={t} />
            </div>
        </div>
    );
}
