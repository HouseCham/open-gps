import type { JSX } from 'react';

import type { ReportTableProps } from '@/types/reports';

/** Wraps report table content with the feature's responsive table containers. */
export function ReportTable({ children }: ReportTableProps): JSX.Element {
    return (
        <div className="reports-card__body">
            <div className="reports-table-wrap">
                <table className="reports-table">{children}</table>
            </div>
        </div>
    );
}
