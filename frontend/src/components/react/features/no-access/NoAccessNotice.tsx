import '@/styles/no-access.css';
import { useEffect, type JSX } from 'react';
import { ShieldOff } from 'lucide-react';
//-- Hooks
import { useAuth } from '@/lib/hooks/useAuth';
//-- Utils
import { redirectTo } from '@/lib';
//-- Constants
import { DENIED_ROUTE_STORAGE_KEY } from '@/constants/auth';
//-- Stores
import { toastBus } from '@/lib/stores/toast.store';
//-- Components
import { Alert } from '@/components/react/ui/Alert';
import { Button } from '@/components/react/ui/button';
//-- Types
import type { Language } from '@/types';

/**
 * Strings rendered by the no-access island. The page frontmatter
 * resolves these from the locale's translation file and passes them
 * in as props so the island never re-imports the i18n bundle on the
 * client.
 * @interface NoAccessStrings
 * @property {string} title - Page title.
 * @property {string} body - Page body copy.
 * @property {string} backCta - Back-to-dashboard button label.
 * @property {string} hint - Hint shown to unauthenticated visitors prompting them to sign in.
 * @property {string} toastTitle - Title of the transient toast that surfaces the reason for the redirect.
 * @property {string} toastMessage - Body of the transient toast.
 */
interface NoAccessStrings {
    title: string;
    body: string;
    backCta: string;
    hint: string;
    toastTitle: string;
    toastMessage: string;
}

/**
 * Props for the NoAccessNotice island.
 * @interface NoAccessNoticeProps
 * @property {Language} locale - The locale used to build the dashboard URL.
 * @property {NoAccessStrings} strings - All user-visible copy.
 */
interface NoAccessNoticeProps {
    locale: Language;
    strings: NoAccessStrings;
}

/**
 * Body of the `/[lan]/no-access` page. Renders a centred warning
 * card with a back-to-dashboard action, and on mount surfaces a
 * transient toast when the redirect was triggered by the
 * `OnlyAdminRoute` gate (the gate writes a flag into
 * `sessionStorage` before redirecting).
 *
 * @param {NoAccessNoticeProps} props - The component props.
 * @returns {JSX.Element} The rendered card.
 */
export function NoAccessNotice({
    locale,
    strings,
}: NoAccessNoticeProps): JSX.Element {
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        let flag: string | null = null;
        try {
            flag = sessionStorage.getItem(DENIED_ROUTE_STORAGE_KEY);
        } catch {
            // Private browsing can throw on sessionStorage access.
            flag = null;
        }
        if (flag !== 'admin') return;
        try {
            sessionStorage.removeItem(DENIED_ROUTE_STORAGE_KEY);
        } catch (error) {
            // Best-effort cleanup; log so failures aren't fully silent.
            console.warn('Failed to clear denied-route flag', error);
        }
        toastBus.push({
            variant: 'warning',
            title: strings.toastTitle,
            message: strings.toastMessage,
        });
    }, [strings.toastTitle, strings.toastMessage]);

    return (
        <section className="no-access">
            <div className="no-access__card">
                <div className="no-access__icon" aria-hidden="true">
                    <ShieldOff size={28} strokeWidth={1.6} />
                </div>
                <h1 className="no-access__title">{strings.title}</h1>
                <p className="no-access__body">{strings.body}</p>
                <Alert
                    tone="warning"
                    title={strings.toastTitle}
                    message={strings.toastMessage}
                />
                <div className="no-access__actions">
                    <Button
                        variant="primary"
                        size="md"
                        onClick={() => redirectTo(`/${locale}`)}
                    >
                        {strings.backCta}
                    </Button>
                </div>
                {!isAuthenticated && (
                    <p className="no-access__hint">{strings.hint}</p>
                )}
            </div>
        </section>
    );
}
