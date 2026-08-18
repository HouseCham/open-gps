import { useEffect, useState } from 'react';
//-- Types
import type { Language } from '@/types';
import type { JSX } from 'react/jsx-runtime';
//-- Styles
import '@/styles/language-toggle.css';
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
    const [currentLocale, setCurrentLocale] = useState<Language>(locale);
    useEffect(() => {
        if (locale === currentLocale) return;
        setCurrentLocale(locale);
        localStorage.setItem('language', locale);
    }, [locale]);

    /**
     * Toggles the language between English and Spanish, updates the current locale state and redirects to the new URL with the appropriate language prefix.
     * @param {Language} locale - The target locale to switch to.
     * @returns {void}
     */
    const toggleLanguage = (next: Language): void => {
        if (next === currentLocale) return;
        setCurrentLocale(next);
        const url = new URL(window.location.href);
        url.pathname = url.pathname.replace(/^\/(en|es)/, `/${next}`);
        window.location.href = url.toString();
    };

    return (
        <div
            className="lang-toggle"
            role="group"
            aria-label="Language switcher"
        >
            <div className="lang-toggle__track">
                <span
                    className={`lang-toggle__pill lang-toggle__pill--${currentLocale}`}
                    aria-hidden="true"
                />
                <button
                    type="button"
                    className={`lang-toggle__opt${currentLocale === 'en' ? ' is-active' : ''}`}
                    aria-pressed={currentLocale === 'en'}
                    data-lang="en"
                    onClick={() => toggleLanguage('en')}
                >
                    EN
                </button>
                <button
                    type="button"
                    className={`lang-toggle__opt${currentLocale === 'es' ? ' is-active' : ''}`}
                    aria-label="Cambiar a español"
                    aria-pressed={currentLocale === 'es'}
                    data-lang="es"
                    onClick={() => toggleLanguage('es')}
                >
                    ES
                </button>
            </div>
        </div>
    );
}
