import '@/styles/ui/modal.css';

import { X } from 'lucide-react';
import { useEffect, type JSX, type ReactNode } from 'react';

/**
 * Size presets for the modal dialog.
 * - `sm` — confirmation prompts and short forms (420px)
 * - `md` — default; Add/Edit forms (480px)
 * - `lg` — multi-field forms and rich content (560px)
 */
export type ModalSize = 'sm' | 'md' | 'lg';

const SIZE_TO_MAX_WIDTH: Record<ModalSize, number> = {
    sm: 420,
    md: 480,
    lg: 560,
};

/**
 * Props for the Modal component.
 * @interface ModalProps
 * @prop {boolean} open - Whether the modal is visible. When `false`, returns null and frees focus.
 * @prop {() => void} onClose - Called on backdrop click (when `dismissible`), close-button click, or Escape key (when `dismissible`).
 * @prop {string} title - Heading text; also used for `aria-label`.
 * @prop {string} [subtitle] - Optional supporting copy under the title.
 * @prop {ReactNode} [footer] - Optional footer area (typically Cancel + primary action buttons).
 * @prop {ModalSize} [size='md'] - Width preset.
 * @prop {boolean} [dismissible=true] - When `false`, suppresses backdrop-click and Escape close. The close button is also hidden when {@link hideCloseButton} is not set.
 * @prop {boolean} [hideCloseButton=false] - When `true`, omits the X close button. Set independently of `dismissible` for cases that want a visible close button but block backdrop / Escape.
 * @prop {ReactNode} [headerActions] - Optional action buttons rendered in the modal header next to (or in place of) the close button. Useful when the modal needs to expose persistent controls like theme or language toggles even while locked.
 * @prop {ReactNode} children - Modal body content.
 */
export interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    footer?: ReactNode;
    size?: ModalSize;
    dismissible?: boolean;
    hideCloseButton?: boolean;
    headerActions?: ReactNode;
    children: ReactNode;
}

/**
 * Modal — accessible dialog with backdrop click + Escape dismiss.
 * Locks body scroll while open, restores focus behavior on close.
 * @param {ModalProps} props
 * @returns {JSX.Element | null}
 */
export function Modal({
    open,
    onClose,
    title,
    subtitle,
    footer,
    size = 'md',
    dismissible = true,
    hideCloseButton = false,
    headerActions,
    children,
}: ModalProps): JSX.Element | null {
    useEffect(() => {
        if (!open) return;
        if (!dismissible) return;
        const onKey = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return (): void => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = previousOverflow;
        };
    }, [open, onClose, dismissible]);

    useEffect(() => {
        if (!open || dismissible) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return (): void => {
            document.body.style.overflow = previousOverflow;
        };
    }, [open, dismissible]);

    if (!open) return null;

    const showCloseButton = dismissible && !hideCloseButton;

    return (
        <div
            className="gp-modal-backdrop"
            onClick={dismissible ? onClose : undefined}
            role="presentation"
        >
            <div
                className={`gp-modal ${size === 'sm' ? 'is-sm' : size === 'lg' ? 'is-lg' : ''}`}
                style={{ maxWidth: SIZE_TO_MAX_WIDTH[size] }}
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={title}
            >
                <header className="gp-modal-head">
                    <div className="gp-modal-head-text">
                        <div className="gp-modal-title">{title}</div>
                        {subtitle && (
                            <div className="gp-modal-sub">{subtitle}</div>
                        )}
                    </div>
                    <div className="gp-modal-head-actions">
                        {headerActions}
                        {showCloseButton && (
                            <button
                                type="button"
                                className="gp-modal-close"
                                onClick={onClose}
                                aria-label="Close"
                            >
                                <X size={14} aria-hidden="true" />
                            </button>
                        )}
                    </div>
                </header>
                <div className="gp-modal-body">{children}</div>
                {footer && <footer className="gp-modal-foot">{footer}</footer>}
            </div>
        </div>
    );
}
