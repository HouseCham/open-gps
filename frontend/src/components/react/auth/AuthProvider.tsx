import { useAuthService } from '@/lib/api/services';
import { useEffect, useRef, type ReactNode } from 'react';
//-- Services
/**
 * @interface AuthProviderProps
 * @property {ReactNode} children - The React tree that depends on the hydrated auth state.
 */
interface AuthProviderProps {
    children: ReactNode;
    showToast?: boolean;
}
/**
 * @function AuthProvider
 * @description A provider that hydrates the auth state.
 * @param {AuthProviderProps} props - The provider props.
 * @returns {JSX.Element} The children wrapped in a fragment.
 */
export function AuthProvider({
    children,
    showToast = true,
}: AuthProviderProps): React.JSX.Element {
    const { getSession } = useAuthService();
    const hydrated = useRef(false);

    useEffect(() => {
        if (hydrated.current) {
            return;
        }
        hydrated.current = true;
        void getSession(showToast);
    }, []);

    return <>{children}</>;
}
