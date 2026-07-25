import { useEffect, useState } from "react";
//-- Types
import type { Language } from "@/types";
import type { JSX } from "react/jsx-runtime";
//-- Icons
import { Globe } from "lucide-react";
/**
 * Props for the LanguageToggle component
 * @interface LanguageToggleProps
 * @prop {Language} locale - The current locale
 */
interface LanguageToggleProps {
    locale: Language;
}
/**
 * Language toggle button. Swaps the URL prefix between /en/ and /es/ so
 * the Astro router renders the matching locale. Persists the choice in
 * localStorage so the next visit keeps the same language.
 * @param {LanguageToggleProps} props - The current locale.
 * @returns {JSX.Element} The rendered button.
 */
export function LanguageToggle({ locale }: LanguageToggleProps): JSX.Element {
    const [currentLocale, setCurrentLocale] = useState<Language>(() => {
        if (typeof document === 'undefined') return locale;
        // Safe: localStorage.getItem returns string | null; the next guard
        // narrows the value to 'en' | 'es' with an explicit equality check.
        const stored = localStorage.getItem('language') as Language | null;
        if (stored === 'en' || stored === 'es') return stored;
        const browser = navigator.language.toLowerCase();
        return browser.startsWith('es') ? 'es' : 'en';
    });

    useEffect(() => {
        localStorage.setItem('language', currentLocale);
    }, [currentLocale]);

    const toggleLanguage = (): void => {
        const next: Language = currentLocale === 'en' ? 'es' : 'en';
        setCurrentLocale(next);
        const pathname = window.location.pathname;
        const newPath = pathname.replace(/^\/(en|es)/, `/${next}`);
        window.location.href = newPath;
    };

    return (
        <button
            type="button"
            className="chrome-icon-btn"
            onClick={toggleLanguage}
            aria-label={
                currentLocale === 'en'
                    ? 'Cambiar a español'
                    : 'Switch to English'
            }
            title={
                currentLocale === 'en'
                    ? 'Cambiar a español'
                    : 'Switch to English'
            }
        >
            <Globe size={16} strokeWidth={1.6} />
        </button>
    );
}