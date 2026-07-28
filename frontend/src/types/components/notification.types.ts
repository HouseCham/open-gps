/**
 * Notification tone.
 * @type {NotificationTone}
 */
export type NotificationTone = 'success' | 'warning' | 'danger' | 'accent';
/**
 * Notification object.
 * @interface ShellNotification
 * @prop {NotificationTone} tone - Notification tone.
 * @prop {string} title - Notification title.
 * @prop {string} message - Notification message.
 * @prop {string} timeAgo - Time since the notification was created.
 * @prop {boolean} [unread=false] - Whether the notification is unread.
 */
export interface ShellNotification {
    tone: NotificationTone;
    title: string;
    message: string;
    timeAgo: string;
    unread?: boolean;
}
