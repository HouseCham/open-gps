import { useEffect, useState, type ReactNode } from 'react';
//-- Hooks
import { useAuth } from '@/lib/hooks/useAuth';
//-- Constants
import { DASHBOARD_PATH, LOGIN_PATH, SIGNUP_PATH } from '@/constants/auth';
//-- Utils
import { redirectTo } from '@/lib';
//-- Services
import { bootstrapService } from '@/lib/api/services';
//-- Types
import type { BootstrapStatus } from '@/types/api';
//-- Components
import { RouteFallback } from './RouteFallback';

/**
 * @interface PublicOnlyRouteProps
 * @property {ReactNode} children - The public tree (sign-in form,
 *   sign-up form, etc.). Rendered only when the user is NOT
 *   authenticated.
 * @property {ReactNode} [fallback] - Optional custom loading UI.
 *   Defaults to `<RouteFallback />`, mirroring `<ProtectedRoute />`.
 * @property {boolean} [isLoginPage] - `true` when this gate wraps the
 *   `/login` screen. Combined with the bootstrap status, it decides
 *   whether `/login` should bounce the visitor to `/signup`
 *   (first-run) or stay put (setup done). Defaults to `false`,
 *   meaning the wrapped page is `/signup`.
 */
interface PublicOnlyRouteProps {
    children: ReactNode;
    fallback?: ReactNode;
    isLoginPage?: boolean;
}

/**
 * Provides a gate for the public tree (sign-in form, sign-up form, etc.).
 * Rendered only when the user is NOT authenticated.
 * @param {PublicOnlyRouteProps} props - The props for the component.
 * @returns {JSX.Element} The fallback, an empty fragment during redirect, or the public children.
 */
export function PublicOnlyRoute({
    children,
    fallback,
    isLoginPage = false,
}: PublicOnlyRouteProps): React.JSX.Element {
    const { isAuthenticated, isAuthLoading } = useAuth();
    const [bootstrapStatus, setBootstrapStatus] =
        useState<BootstrapStatus | null>(null);

    useEffect(() => {
        if (isAuthenticated || bootstrapStatus !== null) return;
        bootstrapService
            .getStatus()
            .then(status => setBootstrapStatus(status))
            .catch(() => setBootstrapStatus({ needsSetup: false }));
    }, [isAuthenticated, bootstrapStatus]);

    useEffect(() => {
        if (isAuthLoading || isAuthenticated) return;
        if (bootstrapStatus === null) return;
        if (isLoginPage && bootstrapStatus.needsSetup) {
            redirectTo(SIGNUP_PATH);
            return;
        }
        if (!isLoginPage && !bootstrapStatus.needsSetup) {
            redirectTo(LOGIN_PATH);
            return;
        }
    }, [isAuthLoading, isAuthenticated, bootstrapStatus, isLoginPage]);

    if (isAuthLoading) {
        return <>{fallback ?? <RouteFallback />}</>;
    }

    if (isAuthenticated) {
        redirectTo(DASHBOARD_PATH);
        return <></>;
    }

    if (bootstrapStatus === null) {
        return <>{fallback ?? <RouteFallback />}</>;
    }

    if (isLoginPage && bootstrapStatus.needsSetup) {
        return <></>;
    }

    if (!isLoginPage && !bootstrapStatus.needsSetup) {
        return <></>;
    }

    return <>{children}</>;
}
