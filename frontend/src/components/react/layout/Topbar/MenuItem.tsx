import type { LucideIcon } from 'lucide-react';
import type { JSX } from 'react/jsx-runtime';
import { Button } from '@/components/react/ui/button';
/**
 * Properties for a menu item.
 * @interface MenuItemProps
 * @property {LucideIcon} icon - The menu item icon.
 * @property {string} label - The menu item label.
 * @property {string} [shortcut] - Optional shortcut text.
 * @property {boolean} [danger] - Optional danger flag.
 * @property {() => void} [onClick] - Optional click handler.
 * @property {string} [href] - When provided, renders as an `<a>` instead of a button.
 * @property {boolean} [external] - When true, opens the link in a new tab. Auto-detected for `http(s)` hrefs.
 */
interface MenuItemProps {
    icon: LucideIcon;
    label: string;
    shortcut?: string;
    danger?: boolean;
    onClick?: () => void;
    href?: string;
    external?: boolean;
}
/**
 * Menu item component.
 * @param {MenuItemProps} props - The props for the component.
 * @returns {JSX.Element} The rendered component.
 */
export function MenuItem({
    icon: Icon,
    label,
    shortcut,
    danger,
    onClick,
    href,
    external,
}: MenuItemProps): JSX.Element {
    const className = `chrome-menu-item${danger ? ' is-danger' : ''}`;
    const iconEl = <Icon size={15} strokeWidth={1.6} className="glyph" />;
    const content = (
        <>
            <span>{label}</span>
            {shortcut && <span className="shortcut">{shortcut}</span>}
        </>
    );

    if (href) {
        const isExternal = external ?? /^https?:\/\//i.test(href);
        return (
            <a
                href={href}
                className={`btn btn-ghost btn-sm ${className}`}
                {...(isExternal
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
            >
                {iconEl}
                {content}
            </a>
        );
    }

    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className={className}
            icon={iconEl}
            onClick={onClick}
        >
            {content}
        </Button>
    );
}
