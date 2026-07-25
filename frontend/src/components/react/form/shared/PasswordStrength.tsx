import type { JSX } from 'react';

/**
 * Score a password from 0 (too short) to 4 (strong). Mirrors the
 * shared signup rule: ≥ 8 chars + mixed case + a digit/symbol + ≥ 12
 * chars. Clamped to 0–4 so callers can index into a 5-label tuple.
 * @param {string} pw - The password to score.
 * @returns {number} The 0–4 strength score.
 */
export function strengthScore(pw: string): number {
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/\d/.test(pw) && /[^\w]/.test(pw)) s++;
    if (pw.length >= 12) s++;
    return Math.min(s, 4);
}

/**
 * Props for the PasswordStrength component.
 * @interface PasswordStrengthProps
 * @property {string} value - The password to render a meter for.
 * @property {string} strengthLabel - Localized "Strength" header.
 * @property {[string, string, string, string, string]} labels - Five
 *   labels indexed by score (0..4).
 */
interface PasswordStrengthProps {
    value: string;
    strengthLabel: string;
    labels: [string, string, string, string, string];
}

/**
 * Four-bar strength meter driven by {@link strengthScore}. Reused by
 * the signup form and the forced change-password modal.
 * @param {PasswordStrengthProps} props
 * @returns {JSX.Element}
 */
export function PasswordStrength({
    value,
    strengthLabel,
    labels,
}: PasswordStrengthProps): JSX.Element {
    const lvl = strengthScore(value);
    return (
        <div className="pw-strength" data-level={lvl} aria-live="polite">
            <div className="bars">
                <span className="bar" />
                <span className="bar" />
                <span className="bar" />
                <span className="bar" />
            </div>
            <div className="legend">
                <span className="mono">{strengthLabel}</span>
                <span className="label" data-active="true">
                    {labels[lvl]}
                </span>
            </div>
        </div>
    );
}
