import '@/styles/ui/signal-indicator.css';
import type { JSX } from 'react/jsx-runtime';

/**
 * Props for the SignalIndicator component.
 * @interface SignalIndicatorProps
 * @prop {number} dbm - Signal strength in dBm (typical range -50 to -100).
 */
export interface SignalIndicatorProps {
    dbm: number;
}

function levelFromDbm(dbm: number): number {
    if (dbm >= -65) return 4;
    if (dbm >= -75) return 3;
    if (dbm >= -85) return 2;
    return 1;
}

/**
 * SignalIndicator — 4-bar cellular/signal strength glyph with dBm readout.
 * @param {SignalIndicatorProps} props
 * @returns {JSX.Element}
 */
export function SignalIndicator({ dbm }: SignalIndicatorProps): JSX.Element {
    const lvl = levelFromDbm(dbm);
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            <span className="signal">
                {[1, 2, 3, 4].map(n => (
                    <span
                        key={n}
                        className={`signal-bar ${n <= lvl ? 'on' : ''}`}
                    />
                ))}
            </span>
            <span className="signal-dbm">{dbm} dBm</span>
        </span>
    );
}
