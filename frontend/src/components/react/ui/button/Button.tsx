import '@/styles/ui/button.css';
import type { ButtonHTMLAttributes, JSX, ReactNode } from 'react';

/**
 * Props for the Button component.
 * @interface ButtonProps
 * @prop {ReactNode} children - Button label/content.
 * @prop {'primary' | 'secondary' | 'ghost' | 'destructive'} variant - Visual style. Default: 'primary'.
 * @prop {'sm' | 'md' | 'lg'} size - Button size. Default: 'md'.
 * @prop {ReactNode} icon - Icon shown before the label.
 * @prop {ReactNode} iconRight - Icon shown after the label.
 * @prop {boolean} iconOnly - Render as square icon-only button (hides label).
 * @prop {boolean} loading - Show spinner and disable interaction.
 * @prop {boolean} disabled - Disabled state.
 */
export interface ButtonProps extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'children'
> {
    children?: ReactNode;
    variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
    size?: 'sm' | 'md' | 'lg';
    icon?: ReactNode;
    iconRight?: ReactNode;
    iconOnly?: boolean;
    loading?: boolean;
}

/**
 * Button — primary action trigger. Supports variants, sizes, icons, and loading.
 * @param {ButtonProps} props
 * @returns {JSX.Element}
 */
export function Button({
    variant = 'primary',
    size = 'md',
    icon,
    iconRight,
    iconOnly,
    loading,
    disabled,
    children,
    className,
    type = 'button',
    ...rest
}: ButtonProps): JSX.Element {
    const cls = [
        'btn',
        `btn-${variant}`,
        `btn-${size}`,
        iconOnly && 'btn-icon-only',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    const content = loading ? (
        <>
            <span className="btn-spinner" aria-hidden="true" />
            <span>{children}</span>
        </>
    ) : iconOnly ? (
        <>{icon}</>
    ) : (
        <>
            {icon}
            {children}
            {iconRight}
        </>
    );

    return (
        <button
            type={type}
            className={cls}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            {...rest}
        >
            {content}
        </button>
    );
}
