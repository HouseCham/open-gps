import type { ReactNode } from 'react';

import type { Translation } from '@/i18n';
import type { DeviceVehicleType, DeviceWithAccess } from '@/types/api';
import type {
    HealthReport,
    OverviewReport,
    QualityReport,
    ReportFilter,
    RoutesReport,
} from '@/types/api/reports.types';

/** Translation namespace consumed by the reports feature. */
export type ReportsTranslations = Translation['page']['reports'];

/** Props received by the reports page island. */
export interface ReportsPageProps {
    translations: ReportsTranslations;
}

/** Loading, success, and error state for an individual report section. */
export interface SectionState<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
}

/** Supported predefined report periods. */
export type Period =
    | 'lastHour'
    | 'lastSixHours'
    | 'lastDay'
    | 'lastWeek'
    | 'custom';

/** Props for the shared report section state component. */
export interface ReportSectionProps<T> {
    state: SectionState<T>;
    title: string;
    description: string;
    retry: () => void;
    children: (data: T) => ReactNode;
    translations: ReportsTranslations;
}

/** Props for the report filters component. */
export interface ReportsFiltersProps {
    devices: DeviceWithAccess[];
    deviceIds: string[];
    from: string;
    period: Period;
    to: string;
    validationError: string | null;
    vehicleType: DeviceVehicleType | '';
    translations: ReportsTranslations;
    onApplyPeriod: (period: Period) => void;
    onDeviceToggle: (id: string) => void;
    onFromChange: (value: string) => void;
    onRefresh: () => void;
    onToChange: (value: string) => void;
    onVehicleTypeChange: (value: DeviceVehicleType | '') => void;
}

/** Props shared by report content sections. */
export interface OverviewContentProps {
    data: OverviewReport;
    translations: ReportsTranslations;
}

/** Props for the routes report section. */
export interface RoutesContentProps {
    data: RoutesReport;
    translations: ReportsTranslations;
}

/** Props for the health report section. */
export interface HealthContentProps {
    data: HealthReport;
    translations: ReportsTranslations;
}

/** Props for the quality report section. */
export interface QualityContentProps {
    data: QualityReport;
    translations: ReportsTranslations;
}

/** Props for a reusable report KPI. */
export interface ReportKpiProps {
    label: string;
    value: string;
    unit: string;
}

/** Props for the report table wrapper. */
export interface ReportTableProps {
    children: ReactNode;
}

/** Props for report export actions. */
export interface ReportExportProps {
    filter: ReportFilter;
    translations: ReportsTranslations;
}
