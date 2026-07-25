import {
    useEffect,
    type PropsWithChildren,
    type ReactNode,
} from 'react';
//-- Hooks
import { useAuth } from '@/lib/hooks/useAuth';
//-- Utils
import { redirectTo } from '@/lib';
import { isSuperAdmin } from '@/lib/role-utils';
//-- Constants
import { DENIED_ROUTE_STORAGE_KEY } from '@/constants/auth';
//-- Types
import type { Language } from '@/types';
//-- Components
import { RouteFallback } from './RouteFallback';

/**
 * Properties for the admin-only route gate.
 * @interface OnlyAdminRouteProps
 * @property {Language} locale - Locale used to build the redirect URL when the user is not a super admin.
 * @property {ReactNode} [fallback] - Optional custom loading UI. Defaults to `<RouteFallback />`.
 */
interface OnlyAdminRouteProps extends PropsWithChildren {
    locale: Language;
    fallback?: ReactNode;
}

/**
 * React island that gates its children behind the `super_admin` role.
 *
 * Flow:
 * - While auth is hydrating (`isAuthLoading`) or the role fetch has
 *   not settled (`!isRoleLoaded`), render `fallback`.
 * - When the session is unauthenticated, render nothing — the parent
 *   `<ProtectedRoute>` is responsible for redirecting to the login or
 *   signup page based on bootstrap status.
 * - When the user is authenticated but not a super admin, write a
 *   one-shot hint into `sessionStorage` so the destination
 *   `no-access.astro` page can surface a transient toast, then
 *   redirect to `/${locale}/no-access`.
 * - When the user is authenticated and a super admin, render the
 *   children.
 *
 * Mirrors the structure of {@link ProtectedRoute} but layered on top
 * of an already-authenticated state — `OnlyAdminRoute` should always
 * be nested inside `<ProtectedRoute>` so the auth gate runs first.
 *
 * @param {OnlyAdminRouteProps} props - The component props.
 * @returns {JSX.Element} The fallback, an empty fragment during redirect, or the protected children.
 */
export function OnlyAdminRoute({
    children,
    locale,
    fallback,
}: OnlyAdminRouteProps): React.JSX.Element {
    const { isAuthenticated, isAuthLoading, role, isRoleLoaded } = useAuth();

    useEffect(() => {
        if (isAuthLoading || !isAuthenticated) return;
        if (!isRoleLoaded) return;
        if (isSuperAdmin(role)) return;
        try {
            sessionStorage.setItem(DENIED_ROUTE_STORAGE_KEY, 'admin');
        } catch (error) {
            // sessionStorage can throw in private-browsing modes; the
            // redirect still works without the toast handoff.
            console.warn('Failed to persist denied-route flag', error);
        }
        redirectTo(`/${locale}/no-access`);
    }, [isAuthLoading, isAuthenticated, isRoleLoaded, role, locale]);

    if (isAuthLoading || !isAuthenticated || !isRoleLoaded) {
        return <>{fallback ?? <RouteFallback />}</>;
    }

    if (!isSuperAdmin(role)) {
        return <></>;
    }

    return <>{children}</>;
}
