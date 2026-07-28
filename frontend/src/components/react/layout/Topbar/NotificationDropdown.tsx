import { useRef } from 'react';
//-- Types
import type { JSX } from 'react/jsx-runtime';
import type { Translation } from '@/i18n';
//-- Constants
import { SHELL_NOTIFICATIONS } from '@/constants';
import { NOTIF_DOT_CLASS } from '@/constants/components';
import { useClickOutside } from '@/lib';

/**
 * Properties for the notifications dropdown component.
 * @interface NotificationDropdownProps
 * @property {Translation['layout']} layout - The layout strings.
 * @property {() => void} [handleClose] - Close handler.
 */
interface NotificationDropdownProps {
    layout: Translation['layout'];
    handleClose: () => void;
}
/**
 * The notifications dropdown component.
 * @param {NotificationDropdownProps} props - The props for the component.
 * @returns {JSX.Element} The rendered component.
 */
export function NotificationsDropdown({
    layout,
    handleClose,
}: NotificationDropdownProps): JSX.Element {
    const ref = useRef<HTMLDivElement>(null);
    useClickOutside(ref, handleClose);

    return (
        <div className="chrome-dropdown" ref={ref} style={{ width: 380 }}>
            <div className="chrome-dropdown-head">
                <div className="chrome-dropdown-title">
                    {layout.notifications}
                </div>
                <span className="chrome-dropdown-link">
                    {layout.markAllRead}
                </span>
            </div>
            <div className="chrome-notif-list">
                {SHELL_NOTIFICATIONS.map((n, i) => (
                    <div
                        key={i}
                        className={`chrome-notif-item${n.unread ? ' is-unread' : ''}`}
                    >
                        <span
                            className={`chrome-notif-dot ${NOTIF_DOT_CLASS[n.tone]}`}
                        />
                        <div>
                            <div className="chrome-notif-title">{n.title}</div>
                            <div className="chrome-notif-msg">{n.message}</div>
                        </div>
                        <div className="chrome-notif-time">{n.timeAgo}</div>
                    </div>
                ))}
            </div>
            <div className="chrome-dropdown-foot">
                <span className="chrome-dropdown-foot-link">
                    {layout.viewAllActivity}
                </span>
            </div>
        </div>
    );
}
