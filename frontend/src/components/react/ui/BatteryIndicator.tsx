import '@/styles/ui/battery-indicator.css';
import type { JSX } from 'react/jsx-runtime';

/**
 * Props for the BatteryIndicator component.
 * @interface BatteryIndicatorProps
 * @prop {number} pct - Battery percentage (0-100).
 * @prop {boolean} showPct - Whether to render the numeric percentage. Default: true.
 */
export interface BatteryIndicatorProps {
    pct: number;
    showPct?: boolean;
}

const CELLS = 4;

function filledCells(pct: number): number {
    if (pct >= 80) return 4;
    if (pct >= 60) return 3;
    if (pct >= 40) return 2;
    if (pct >= 20) return 1;
    return 0;
}

/**
 * BatteryIndicator — 4-segment battery glyph with color thresholds.
 * @param {BatteryIndicatorProps} props
 * @returns {JSX.Element}
 */
export function BatteryIndicator({
    pct,
    showPct = true,
}: BatteryIndicatorProps): JSX.Element {
    const filled = filledCells(pct);
    return (
        <span className="battery">
            <span className="battery-shell">
                {Array.from({ length: CELLS }).map((_, i) => {
                    const isOn = i < filled;
                    const isCrit = isOn && pct < 15;
                    const isWarn = isOn && pct < 30 && pct >= 15;
                    const cellCls = [
                        'battery-cell',
                        isOn && 'on',
                        isCrit && 'crit',
                        isWarn && 'warn',
                    ]
                        .filter(Boolean)
                        .join(' ');
                    return <span key={i} className={cellCls} />;
                })}
            </span>
            {showPct && (
                <span className="battery-pct">
                    {pct}
                    <span style={{ opacity: 0.6 }}>%</span>
                </span>
            )}
        </span>
    );
}
