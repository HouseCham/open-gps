import '@/styles/ui/field-group.css';

import type { JSX, MouseEventHandler } from 'react';

/**
 * Props for the FieldGroup component — input joined to a trailing button.
 * @interface FieldGroupProps
 * @prop {string} value - Input value.
 * @prop {(v: string) => void} onChange - Input change handler.
 * @prop {string} placeholder - Input placeholder.
 * @prop {string} buttonLabel - Label of the trailing button. Default: 'Subscribe'.
 * @prop {() => void} onButtonClick - Click handler for the trailing button.
 */
export interface FieldGroupProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    buttonLabel?: string;
    onButtonClick?: MouseEventHandler<HTMLButtonElement>;
}

/**
 * FieldGroup — input + button joined together (e.g., subscribe forms).
 * @param {FieldGroupProps} props
 * @returns {JSX.Element}
 */
export function FieldGroup({
    value,
    onChange,
    placeholder,
    buttonLabel = 'Subscribe',
    onButtonClick,
}: FieldGroupProps): JSX.Element {
    return (
        <div className="field-group">
            <input
                type="text"
                className="input"
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
            />
            <button
                type="button"
                className="btn btn-md btn-primary"
                onClick={onButtonClick}
            >
                {buttonLabel}
            </button>
        </div>
    );
}
