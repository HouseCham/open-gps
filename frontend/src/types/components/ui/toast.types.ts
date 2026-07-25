export type ToastVariant = 'success' | 'error' | 'warning' | 'info';
/**
 * @interface ToastItem
 * @property {string} id - The unique identifier of the toast.
 * @property {ToastVariant} variant - The variant of the toast.
 * @property {string} title - The title of the toast.
 * @property {string | undefined} message - The message of the toast.
 * @property {number | undefined} duration - The duration of the toast in milliseconds.
 * @property {{ label: string; onClick: () => void } | undefined} action - The action of the toast.
 */
export interface ToastItem {
    id: string;
    variant: ToastVariant;
    title: string;
    message?: string;
    duration?: number;
    action?: { label: string; onClick: () => void };
}
/**
 * @interface ToastHandle
 * @property {ToastItem[]} toasts - The toasts.
 * @property {function} push - The function to push a toast.
 * @property {function} dismiss - The function to dismiss a toast.
 * @property {function} clear - The function to clear all toasts.
 *
 * Note: there is no `Container` field — a single `<ToastProvider />`
 * island is mounted at the app root and reads the bus directly.
 */
export interface ToastHandle {
    toasts: ToastItem[];
    push: (item: Omit<ToastItem, 'id'>) => string;
    dismiss: (id: string) => void;
    clear: () => void;
}

/**
 * Props for the {@link Toast} component. Mirrors the gallery markup:
 * a single toast rendered in tone, with optional body copy, action,
 * and dismiss control.
 * @interface ToastProps
 * @prop {ToastItem} toast - Toast payload from the bus.
 * @prop {(id: string) => void} onDismiss - Dismiss handler keyed by id.
 */
export interface ToastProps {
    toast: ToastItem;
    onDismiss: (id: string) => void;
}

/**
 * Props for the {@link ToastStack} component. The provider reads
 * from the bus and passes the snapshot down; the stack itself is a
 * pure presentational wrapper.
 * @interface ToastStackProps
 * @prop {ToastItem[]} toasts - Snapshot of the toast queue.
 * @prop {(id: string) => void} onDismiss - Dismiss handler keyed by id.
 */
export interface ToastStackProps {
    toasts: ToastItem[];
    onDismiss: (id: string) => void;
}
