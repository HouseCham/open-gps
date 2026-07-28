import '@/styles/ui/kpi-card.css';

import type { JSX, ReactNode } from 'react';

/**
 * Single point on the sparkline. Pass an array of values to render the sparkline.
 * @interface KpiSparkPoint
 * @prop {number} v - Value (will be normalized against max).
 */
export interface KpiSparkPoint {
    v: number;
}

/**
 * Props for the KpiCard component.
 * @interface KpiCardProps
 * @prop {ReactNode} icon - Icon shown next to the label.
 * @prop {string} label - Card title.
 * @prop {string | number} value - Main numeric value.
 * @prop {string} unit - Optional unit suffix.
 * @prop {string} delta - Optional delta text (e.g. "+12%").
 * @prop {'up' | 'down'} deltaDir - Trend direction. Default: 'up'.
 * @prop {number[]} spark - Sparkline values (relative scale).
 */
export interface KpiCardProps {
    icon?: ReactNode;
    label: string;
    value: string | number;
    unit?: string;
    delta?: string;
    deltaDir?: 'up' | 'down';
    spark?: number[];
}

/**
 * KpiCard — high-level metric tile with optional sparkline and delta.
 * @param {KpiCardProps} props
 * @returns {JSX.Element}
 */
export function KpiCard({
    icon,
    label,
    value,
    unit,
    delta,
    deltaDir = 'up',
    spark = [],
}: KpiCardProps): JSX.Element {
    return (
        <div className="kpi-card">
            <div className="kpi-card-head">
                {icon && <div className="kpi-card-icon">{icon}</div>}
                <div className="kpi-card-label">{label}</div>
            </div>
            <div className="kpi-card-num">
                {value}
                {unit && <span className="unit">{unit}</span>}
            </div>
            <div className="kpi-card-foot">
                {delta != null && (
                    <span
                        className={
                            deltaDir === 'up'
                                ? 'kpi-delta-up'
                                : 'kpi-delta-down'
                        }
                    >
                        {deltaDir === 'up' ? '▲' : '▼'} {delta}
                    </span>
                )}
                {spark.length > 0 && (
                    <div className="kpi-sparkline" aria-hidden="true">
                        {spark.map((v, i) => {
                            const max = Math.max(...spark);
                            const h = Math.max(4, Math.round((v / max) * 20));
                            return (
                                <span
                                    key={i}
                                    style={{ height: `${h}px` }}
                                    className={
                                        i === spark.length - 1 ? 'on' : ''
                                    }
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
