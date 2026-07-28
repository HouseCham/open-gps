import '@/styles/ui/textarea.css';

import type { JSX, TextareaHTMLAttributes } from 'react';

/**
 * Props for the Textarea component.
 * @interface TextareaProps
 * @prop {number} rows - Visible rows. Default 4.
 */
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    invalid?: boolean;
}

/**
 * Textarea — multi-line text field.
 * @param {TextareaProps} props
 * @returns {JSX.Element}
 */
export function Textarea({
    rows = 4,
    invalid,
    className = '',
    ...rest
}: TextareaProps): JSX.Element {
    return (
        <textarea
            rows={rows}
            className={`textarea ${className}`}
            aria-invalid={invalid || undefined}
            {...rest}
        />
    );
}
