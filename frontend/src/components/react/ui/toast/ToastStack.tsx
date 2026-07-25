import '@/styles/ui/toast.css';
//-- Types
import type { JSX } from 'react';
import type { ToastStackProps } from '@/types/components/ui';
//-- Components
import { Toast } from '@/components/react/ui/toast/Toast';

/**
 * ToastStack — global notification container. Rendered once at the app
 * root by {@link ToastProvider}; reads the toast queue and renders
 * each entry through {@link Toast}. The `aria-live` region is the
 * stack itself so screen readers announce new notifications without
 * stealing focus.
 * @param {ToastStackProps} props - Snapshot of toasts + dismiss handler.
 * @returns {JSX.Element}
 */
export function ToastStack({ toasts, onDismiss }: ToastStackProps): JSX.Element {
    return (
        <div className="gp-toast-stack" aria-live="polite" aria-atomic="false">
            {toasts.map(t => (
                <Toast key={t.id} toast={t} onDismiss={onDismiss} />
            ))}
        </div>
    );
}