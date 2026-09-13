import { Download } from 'lucide-react';
import type { JSX } from 'react';

import { reportsService } from '@/lib/api/services/reportsService';
import type { ReportExportProps } from '@/types/reports';

/** Renders CSV and GPX export links for the active report filter. */
export function ReportExport({
    filter,
    translations: t,
}: ReportExportProps): JSX.Element {
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
