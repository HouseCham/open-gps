import { Info } from 'lucide-react';
import type { JSX } from 'react';

/** Renders the standard explanatory note used by report sections. */
export function ReportDisclaimer({
    children,
}: {
    children: string;
}): JSX.Element {
    return (
        <div className="reports-card__body">
            <div className="reports-disclaimer">
                <Info size={14} />
                {children}
            </div>
        </div>
    );
}
