import type { NotificationTone } from '@/types/components';
/**
 * @constant NOTIF_DOT_CLASS
 * @description Class for each notification tone
 */
export const NOTIF_DOT_CLASS: Record<NotificationTone, string> = {
    success: 'success',
    warning: 'warning',
    danger: 'danger',
    accent: 'accent',
};
