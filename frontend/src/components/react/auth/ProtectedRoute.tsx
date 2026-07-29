import {
    useEffect,
    useState,
    type PropsWithChildren,
    type ReactNode,
} from 'react';
//-- Hooks
import { useAuth } from '@/lib/hooks/useAuth';
//-- Constants
import { LOGIN_PATH, SIGNUP_PATH } from '@/constants/auth';
import { redirectTo } from '@/lib';
//-- Services
import { bootstrapService } from '@/lib/api/services';
//-- Types
import type { BootstrapStatus } from '@/types/api';
//-- Components
import { RouteFallback } from './RouteFallback';

/**
 * @interface ProtectedRouteProps
 * @property {ReactNode} children - The protected tree. Rendered only when the user is authenticated and (if applicable) past the change-password gate.
 * @property {ReactNode} [fallback] - Optional custom loading UI. Defaults to `<RouteFallback />`.
 */
interface ProtectedRouteProps extends PropsWithChildren {
    fallback?: ReactNode;
    loadingMessage: string;
}

/**
 * Provides a gate for the protected tree (dashboard, etc.).
 * Rendered only when the user is authenticated.
 * @param {ProtectedRouteProps} props - The component props.
 * @returns {JSX.Element} The fallback, an empty fragment during redirect, or the protected children.
 */
export function ProtectedRoute({
    children,
    fallback,
    loadingMessage,
}: ProtectedRouteProps): React.JSX.Element {
    const { isAuthenticated, isAuthLoading } = useAuth();
    const [bootstrapStatus, setBootstrapStatus] =
        useState<BootstrapStatus | null>(null);

    useEffect(() => {
        if (isAuthLoading || isAuthenticated || bootstrapStatus !== null)
            return;
        bootstrapService
            .getStatus()
            .then(status => setBootstrapStatus(status))
            .catch(error => {
                console.error('Bootstrap status failed', error);
                setBootstrapStatus({ needsSetup: false });
            });
    }, [isAuthLoading, isAuthenticated, bootstrapStatus]);

    useEffect(() => {
        if (isAuthLoading || isAuthenticated) return;
        if (bootstrapStatus === null) return;
        redirectTo(bootstrapStatus.needsSetup ? SIGNUP_PATH : LOGIN_PATH);
    }, [isAuthLoading, isAuthenticated, bootstrapStatus]);

    if (isAuthLoading) {
        return <>{fallback ?? <RouteFallback message={loadingMessage} />}</>;
    }

    if (!isAuthenticated && bootstrapStatus === null) {
        return <>{fallback ?? <RouteFallback message={loadingMessage} />}</>;
    }

    if (!isAuthenticated) {
        return <></>;
    }

    return <>{children}</>;
}
