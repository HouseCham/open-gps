/**
 * Variant → Lucide icon component for toasts. The gallery keyed tones by
 * `success | info | warning | error`; the runtime model reuses the same
 * labels, so the mapping is one-to-one. Keep this table next to the
 * class map so a new variant lands in both places.
 */
import type { ToastVariant } from '@/types/components/ui';
import { CheckCircle2, CircleX, Info, TriangleAlert, type LucideIcon } from 'lucide-react';

/**
 * @constant
 * @description Icon component for each toast variant.
 * @type {Record<ToastVariant, LucideIcon>}
 */
export const TOAST_VARIANT_ICON: Record<ToastVariant, LucideIcon> = {
    success: CheckCircle2,
    error: CircleX,
    warning: TriangleAlert,
    info: Info,
};

/**
 * @constant
 * @description CSS class applied to the toast element for each variant.
 * @type {Record<ToastVariant, string>}
 */
export const TOAST_VARIANT_CLASS: Record<ToastVariant, string> = {
    success: 'gp-toast--success',
    error: 'gp-toast--error',
    warning: 'gp-toast--warning',
    info: 'gp-toast--info',
};

/**
 * Default auto-dismiss duration in milliseconds. Error toasts stick
 * longer by default — the gallery never timed out, but real users
 * need time to read the message.
 * @constant {number}
 */
export const TOAST_DEFAULT_DURATION_MS = 5000;

/**
 * Duration errors stay on screen before auto-dismiss. Longer than the
 * default so users can read the cause before it disappears.
 * @constant {number}
 */
export const TOAST_ERROR_DURATION_MS = 8000;