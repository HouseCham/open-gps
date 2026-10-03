import { RefreshCw } from 'lucide-react';
import type { JSX, ReactNode } from 'react';

import { Button } from '@/components/react/ui/button';
import type { ReportSectionProps } from '@/types/reports';

/** Displays the shared card, loading, error, and success states for a report. */
export function ReportSection<T>({
    state,
    title,
    description,
    retry,
    children,
    translations: t,
}: ReportSectionProps<T>): JSX.Element {
    if (state.loading) {
        return (
            <ReportCard title={title} description={description}>
                <div className="reports-empty" aria-busy="true">
                    {t.loading}
                </div>
            </ReportCard>
        );
    }

    if (state.error || !state.data) {
        return (
            <ReportCard title={title} description={description}>
                <div className="reports-empty" role="alert">
                    <p>{state.error ?? t.noData}</p>
                    <Button variant="ghost" size="sm" onClick={retry}>
                        <RefreshCw size={14} />
                        {t.retry}
                    </Button>
                </div>
            </ReportCard>
        );
    }

    return (
        <ReportCard title={title} description={description}>
            {children(state.data)}
        </ReportCard>
    );
}

interface ReportCardProps {
    title: string;
    description: string;
    children: ReactNode;
}

/** Provides the standard visual container for a report section. */
function ReportCard({
    title,
    description,
    children,
}: ReportCardProps): JSX.Element {
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
