import '@/styles/ui/toast.css';
//-- Types
import type { JSX } from 'react';
import type { ToastProps } from '@/types/components/ui';
//-- Constants
import {
    TOAST_VARIANT_CLASS,
    TOAST_VARIANT_ICON,
} from '@/constants/components/ui/toast.constants';
//-- Icons
import { X } from 'lucide-react';

/**
 * Toast — single notification row inside the global stack. Pure
 * presentational; the {@link ToastProvider} island owns the queue.
 * @param {ToastProps} props - The toast payload and dismiss handler.
 * @returns {JSX.Element}
 */
export function Toast({ toast, onDismiss }: ToastProps): JSX.Element {
    const Icon = TOAST_VARIANT_ICON[toast.variant];
    return (
        <div
            className={`gp-toast ${TOAST_VARIANT_CLASS[toast.variant]}`}
            role={toast.variant === 'error' ? 'alert' : 'status'}
        >
            <div className="gp-toast-icon" aria-hidden="true">
                <Icon size={13} />
            </div>
            <div className="gp-toast-body">
                <div className="gp-toast-title">{toast.title}</div>
                {toast.message && (
                    <div className="gp-toast-msg">{toast.message}</div>
                )}
                {toast.action && (
                    <button
                        type="button"
                        className="gp-toast-action"
                        onClick={toast.action.onClick}
                    >
                        {toast.action.label}
                    </button>
                )}
            </div>
            <button
                type="button"
                className="gp-toast-close"
                onClick={(): void => onDismiss(toast.id)}
                aria-label="Dismiss"
            >
                <X size={12} aria-hidden="true" />
            </button>
        </div>
    );
}