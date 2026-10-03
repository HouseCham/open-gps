import type { Envelope } from '@/types/api';
import { apiClient } from '@/lib/api/client';
import type {
    HealthReport,
    OverviewReport,
    QualityReport,
    ReportFilter,
    RoutesReport,
} from '@/types/api/reports.types';

/** Builds the query parameters shared by report endpoints. */
function buildQuery(filter: ReportFilter): Record<string, string> {
    const params: Record<string, string> = {
        from: filter.from,
        to: filter.to,
        'time-zone': filter.timeZone,
    };

    if (filter.deviceIds.length > 0) {
        params.device_ids = filter.deviceIds.join(',');
    }
    if (filter.vehicleType) {
        params.vehicle_type = filter.vehicleType;
    }

    return params;
}

/** Fetches one typed report response from the API. */
async function request<T>(path: string, filter: ReportFilter): Promise<T> {
    const result = await apiClient<Envelope<T>>(path, {
        method: 'GET',
        query: buildQuery(filter),
    });

    if (
        !result.data ||
        result.data.status_code < 200 ||
        result.data.status_code >= 300
    ) {
        throw new Error(result.data?.message ?? 'Report request failed');
    }

    return result.data.data;
}

/** Reports API client used by the reports page. */
export const reportsService = {
    overview: (filter: ReportFilter): Promise<OverviewReport> =>
        request<OverviewReport>('/reports/overview', filter),
    routes: (filter: ReportFilter): Promise<RoutesReport> =>
        request<RoutesReport>('/reports/routes', filter),
    health: (filter: ReportFilter): Promise<HealthReport> =>
        request<HealthReport>('/reports/health', filter),
    quality: (filter: ReportFilter): Promise<QualityReport> =>
        request<QualityReport>('/reports/data-quality', filter),
    exportUrl: (filter: ReportFilter, format: 'csv' | 'gpx'): string => {
        const apiOrigin = import.meta.env.PUBLIC_API_URL || '';
        const params = new URLSearchParams(buildQuery(filter));
        params.set('format', format);
        return `${apiOrigin}/api/v1/reports/export?${params.toString()}`;
    },
};
