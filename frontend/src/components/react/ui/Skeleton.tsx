import '@/styles/ui/skeleton.css';

import type { CSSProperties, JSX } from 'react';

/**
 * Props for the Skeleton component — loading placeholder.
 * @interface SkeletonProps
 * @prop {'text' | 'text-sm' | 'block' | 'card' | 'row'} variant - Shape variant. Default: 'text'.
 * @prop {number | string} width - Width override.
 * @prop {number | string} height - Height override.
 * @prop {CSSProperties} style - Additional inline styles.
 */
export interface SkeletonProps {
    variant?: 'text' | 'text-sm' | 'block' | 'card' | 'row';
    width?: number | string;
    height?: number | string;
    style?: CSSProperties;
}

/**
 * Skeleton — shimmering placeholder while content loads.
 * @param {SkeletonProps} props
 * @returns {JSX.Element}
 */
export function Skeleton({
    variant = 'text',
    width,
    height,
    style,
}: SkeletonProps): JSX.Element {
    if (variant === 'card') {
        return (
            <div className="skel-card">
                <span className="skeleton skel-text" style={{ width: '60%' }} />
                <span
                    className="skeleton skel-text-sm"
                    style={{ width: '40%' }}
                />
                <span
                    className="skeleton skel-block"
                    style={{ marginTop: 'auto' }}
                />
            </div>
        );
    }
    if (variant === 'row') {
        return (
            <div className="skel-row">
                <span
                    className="skeleton"
                    style={{ width: 24, height: 24, borderRadius: '50%' }}
                />
                <span className="skeleton skel-text" style={{ width: '60%' }} />
            </div>
        );
    }
    return (
        <span
            className={`skeleton skel-${variant}`}
            style={{ width, height, ...style }}
        />
    );
}
