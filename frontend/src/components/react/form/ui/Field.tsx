import '@/styles/ui/field.css';

import type { JSX, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Props for the Field component — wrapper that pairs label, control, help, and error.
 * @interface FieldProps
 * @prop {ReactNode} children - The form control (Input, Textarea, Select…).
 * @prop {string} label - Visible field label.
 * @prop {boolean} required - Shows a red asterisk next to the label.
 * @prop {string} help - Helper text shown below the control when no error.
 * @prop {string} error - Error message; takes precedence over help.
 * @prop {string} htmlFor - id of the control for label association.
 */
export interface FieldProps {
    children: ReactNode;
    label?: string;
    required?: boolean;
    help?: string;
    error?: string;
    htmlFor?: string;
}

/**
 * Field — wraps a control with label/help/error.
 * @param {FieldProps} props
 * @returns {JSX.Element}
 */
export function Field({
    label,
    required,
    help,
    error,
    children,
    htmlFor,
}: FieldProps): JSX.Element {
    return (
        <div className="field">
            {label && (
                <label className="field-label" htmlFor={htmlFor}>
                    {label}
                    {required && (
                        <span className="req" aria-hidden="true">
                            *
                        </span>
                    )}
                </label>
            )}
            {children}
            {help && !error && <div className="field-help">{help}</div>}
            {error && (
                <div className="field-error" role="alert">
                    <AlertTriangle size={12} aria-hidden="true" />
                    {error}
                </div>
            )}
        </div>
    );
}
