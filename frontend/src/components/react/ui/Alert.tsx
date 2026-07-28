import '@/styles/ui/alert.css';

import type { JSX, MouseEventHandler, ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Props for the Alert component.
 * @interface AlertProps
 * @prop {'info' | 'success' | 'warning' | 'danger'} tone - Color tone. Default: 'info'.
 * @prop {ReactNode} icon - Leading icon.
 * @prop {string} title - Alert title (required).
 * @prop {string} message - Optional body copy.
 * @prop {ReactNode} actions - Optional action buttons at the bottom.
 * @prop {() => void} onClose - If set, shows a dismiss button.
 */
export interface AlertProps {
    tone?: 'info' | 'success' | 'warning' | 'danger';
    icon?: ReactNode;
    title: string;
    message?: string;
    actions?: ReactNode;
    onClose?: MouseEventHandler<HTMLButtonElement>;
}

/**
 * Alert — inline notice with tone-colored left border and optional dismiss.
 * @param {AlertProps} props
 * @returns {JSX.Element}
 */
export function Alert({
    tone = 'info',
    icon,
    title,
    message,
    actions,
    onClose,
}: AlertProps): JSX.Element {
    return (
        <div className={`alert alert-${tone}`} role="status">
            {icon && <div className="alert-icon">{icon}</div>}
            <div className="alert-body">
                <div className="alert-title">{title}</div>
                {message && <div className="alert-msg">{message}</div>}
                {actions && <div className="alert-actions">{actions}</div>}
            </div>
            {onClose && (
                <button
                    type="button"
                    className="alert-close"
                    onClick={onClose}
                    aria-label="Dismiss alert"
                >
                    <X size={14} aria-hidden="true" />
                </button>
            )}
        </div>
    );
}
