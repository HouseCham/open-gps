//-- store
import { useStore } from '@nanostores/react';
import {
    $isAuthenticated,
    $isAuthLoading,
    $isRoleLoaded,
    $user,
    $userRole,
} from '@/lib/stores/auth';
//-- types
import type { UseAuthResult } from '@/types/api';
//-- services
import { useAuthService } from '@/lib/api/services';
/**
 * React hook for reading and acting on the auth state.
 *
 * Subscribes to `$user`, `$isAuthenticated`, `$isAuthLoading`,
 * `$userRole`, and `$isRoleLoaded` so the component re-renders
 * whenever any of them change. Returns the current snapshot plus the
 * `authService` actions bound to the same store, which guarantees a
 * single source of truth across the app.
 *
 * @returns {UseAuthResult} The current auth snapshot and actions.
 */
export function useAuth(): UseAuthResult {
    const { signIn, signUp, signInOAuth, signOut } = useAuthService();
    const user = useStore($user);
    const isAuthenticated = useStore($isAuthenticated);
    const isAuthLoading = useStore($isAuthLoading);
    const role = useStore($userRole);
    const isRoleLoaded = useStore($isRoleLoaded);

    return {
        user,
        isAuthenticated,
        isAuthLoading,
        role,
        isRoleLoaded,
        signIn: signIn,
        signUp: signUp,
        signInOAuth: signInOAuth,
        signOut: signOut,
    };
}
