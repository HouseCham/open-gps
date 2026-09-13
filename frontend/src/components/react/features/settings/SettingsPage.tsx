import '@/styles/settings.css';
import { useState, type ChangeEvent, type JSX } from 'react';
//-- Stores
import { useStore } from '@nanostores/react';
import { $profile, $user } from '@/lib/stores/auth';
import {
    $localSettings,
    resetLocalSettings,
    updateLocalSetting,
} from '@/lib/stores/settings';
//-- Hooks
import { useTheme, isTheme } from '@/lib/hooks/useTheme';
//-- I18n
import { getTranslation, type Translation } from '@/i18n';
//-- Utils
import {
    isSettingValue,
    parseChangePasswordStrings,
    redirectTo,
    buildLocalizedUrl,
} from '@/lib';
//-- Types
import type { Language, LocalSettings } from '@/types';
//-- Components
import { ChangePasswordModal } from '@/components/react/modal';
import { Button } from '@/components/react/ui/button';
import { SettingsChoice } from './SettingsChoice';
//-- Icons
import { Moon, RotateCcw, ShieldCheck, Sun } from 'lucide-react';

const HISTORY_RANGES = ['1h', '6h', '24h', '7d'] as const;
const LANDING_PAGES = ['dashboard', 'devices'] as const;
const TIME_ZONES = [
    'America/Mexico_City',
    'Europe/Madrid',
    'America/Bogota',
] as const;
/**
 * Props for the SettingsPage component
 * @interface SettingsPageProps
 * @prop {Language} locale - The locale for the page.
 * @prop {Translation['settings']} translations - The translations for the page.
 */
export interface SettingsPageProps {
    locale: Language;
    translations: Translation['settings'];
}
/**
 * The SettingsPage component
 * @param {SettingsPageProps} props - The props for the component.
 * @returns {JSX.Element} The rendered component.
 */
export function SettingsPage({
    locale,
    translations: t,
}: SettingsPageProps): JSX.Element {
    const user = useStore($user);
    const profile = useStore($profile);
    const [theme, setTheme] = useTheme();
    const preferences = useStore($localSettings);
    const [passwordOpen, setPasswordOpen] = useState(false);
    /**
     * Updates one local setting and persists it immediately.
     * @param {keyof LocalSettings} key - The setting key.
     * @param {LocalSettings[keyof LocalSettings]} value - The setting value.
     * @returns {void}
     */
    const update = <K extends keyof LocalSettings>(
        key: K,
        value: LocalSettings[K]
    ): void => {
        updateLocalSetting(key, value);
    };
    /** Restores environment-aware defaults and the light theme. */
    const reset = (): void => {
        resetLocalSettings();
        setTheme('light');
    };
    // The select options are restricted to the Theme union values above.
    const role = profile?.role === 'super_admin' ? t.superAdmin : t.user;
    const changeTheme = (event: ChangeEvent<HTMLSelectElement>): void => {
        const value = event.target.value;
        if (isTheme(value)) setTheme(value);
    };
    const changeLocale = (nextLocale: Language): void => {
        const localizedUrl = buildLocalizedUrl(
            window.location.pathname,
            window.location.search,
            window.location.hash,
            nextLocale
        );
        if (localizedUrl) window.location.assign(localizedUrl);
    };

    return (
        <div className="settings-page">
            {/* Header */}
            <header className="settings-header">
                <div>
                    <div className="settings-eyebrow">{t.eyebrow}</div>
                    <h1>{t.title}</h1>
                    <p>{t.intro}</p>
                </div>
                <div className="settings-saved" role="status">
                    {t.saved}
                </div>
            </header>
            {/* Page content */}
            <div className="settings-layout">
                {/* Main content */}
                <main className="settings-main">
                    {/* Appearance - Theme - Language - Sidebar initial state - Reduce motion */}
                    <section className="settings-card">
                        <header>
                            <h2>{t.appearance}</h2>
                            <p>{t.appearanceSub}</p>
                        </header>
                        <div className="settings-row">
                            <div>
                                <strong>{t.theme}</strong>
                                <p>{t.themeHint}</p>
                            </div>
                            <select
                                value={theme}
                                onChange={changeTheme}
                                aria-label={t.theme}
                            >
                                <option value="light">{t.light}</option>
                                <option value="dark">{t.dark}</option>
                            </select>
                        </div>
                        <div className="settings-row">
                            <div>
                                <strong>{t.language}</strong>
                                <p>{t.languageHint}</p>
                            </div>
                            <div className="settings-segmented">
                                <Button
                                    type="button"
                                    variant={
                                        locale === 'es'
                                            ? 'primary'
                                            : 'secondary'
                                    }
                                    onClick={() => changeLocale('es')}
                                >
                                    {t.languageSpanish}
                                </Button>
                                <Button
                                    type="button"
                                    variant={
                                        locale === 'en'
                                            ? 'primary'
                                            : 'secondary'
                                    }
                                    onClick={() => changeLocale('en')}
                                >
                                    {t.languageEnglish}
                                </Button>
                            </div>
                        </div>
                        <div className="settings-row">
                            <div>
                                <strong>{t.sidebarState}</strong>
                                <p>{t.sidebarHint}</p>
                            </div>
                            <div className="settings-segmented">
                                <SettingsChoice
                                    name="sidebar"
                                    value="open"
                                    label={t.expanded}
                                    checked={
                                        preferences.sidebarInitialState ===
                                        'expanded'
                                    }
                                    onChange={() =>
                                        update(
                                            'sidebarInitialState',
                                            'expanded'
                                        )
                                    }
                                />
                                <SettingsChoice
                                    name="sidebar"
                                    value="closed"
                                    label={t.collapsed}
                                    checked={
                                        preferences.sidebarInitialState ===
                                        'collapsed'
                                    }
                                    onChange={() =>
                                        update(
                                            'sidebarInitialState',
                                            'collapsed'
                                        )
                                    }
                                />
                            </div>
                        </div>
                        <div className="settings-row">
                            <div>
                                <strong>{t.motion}</strong>
                                <p>{t.motionHint}</p>
                            </div>
                            <label className="settings-switch">
                                <input
                                    type="checkbox"
                                    checked={preferences.reduceMotion}
                                    onChange={event =>
                                        update(
                                            'reduceMotion',
                                            event.target.checked
                                        )
                                    }
                                />
                                <span>
                                    {preferences.reduceMotion ? t.on : t.off}
                                </span>
                            </label>
                        </div>
                    </section>
                    {/* Display - Default time range - First page - Information density */}
                    <section className="settings-card">
                        <header>
                            <h2>{t.display}</h2>
                            <p>{t.displaySub}</p>
                        </header>
                        <div className="settings-row">
                            <div>
                                <strong>{t.history}</strong>
                                <p>{t.historyHint}</p>
                            </div>
                            <select
                                value={preferences.defaultHistoryRange}
                                onChange={event => {
                                    const value = event.target.value;
                                    if (isSettingValue(value, HISTORY_RANGES)) {
                                        update('defaultHistoryRange', value);
                                    }
                                }}
                                aria-label={t.history}
                            >
                                <option value="1h">{t.lastHour}</option>
                                <option value="6h">{t.lastSixHours}</option>
                                <option value="24h">{t.lastDay}</option>
                                <option value="7d">{t.lastWeek}</option>
                            </select>
                        </div>
                        <div className="settings-row">
                            <div>
                                <strong>{t.landing}</strong>
                                <p>{t.landingHint}</p>
                            </div>
                            <select
                                value={preferences.landingPage}
                                onChange={event => {
                                    const value = event.target.value;
                                    if (isSettingValue(value, LANDING_PAGES)) {
                                        update('landingPage', value);
                                    }
                                }}
                                aria-label={t.landing}
                            >
                                <option value="dashboard">{t.dashboard}</option>
                                <option value="devices">{t.devices}</option>
                            </select>
                        </div>
                    </section>
                    {/* Region - Timezone - Time format */}
                    <section className="settings-card">
                        <header>
                            <h2>{t.region}</h2>
                            <p>{t.regionSub}</p>
                        </header>
                        <div className="settings-row">
                            <div>
                                <strong>{t.timezone}</strong>
                                <p>{t.timezoneHint}</p>
                            </div>
                            <select
                                value={preferences.timeZone}
                                onChange={event =>
                                    update('timeZone', event.target.value)
                                }
                                aria-label={t.timezone}
                            >
                                {!isSettingValue(
                                    preferences.timeZone,
                                    TIME_ZONES
                                ) && (
                                    <option value={preferences.timeZone}>
                                        {preferences.timeZone}
                                    </option>
                                )}
                                <option value="America/Mexico_City">
                                    America/Mexico_City
                                </option>
                                <option value="Europe/Madrid">
                                    Europe/Madrid
                                </option>
                                <option value="America/Bogota">
                                    America/Bogota
                                </option>
                            </select>
                        </div>
                        <div className="settings-row">
                            <div>
                                <strong>{t.timeFormat}</strong>
                                <p>{t.timeHint}</p>
                            </div>
                            <div className="settings-segmented">
                                <SettingsChoice
                                    name="hours"
                                    value="12"
                                    label={t.hours12}
                                    checked={preferences.timeFormat === '12h'}
                                    onChange={() => update('timeFormat', '12h')}
                                />
                                <SettingsChoice
                                    name="hours"
                                    value="24"
                                    label={t.hours24}
                                    checked={preferences.timeFormat === '24h'}
                                    onChange={() => update('timeFormat', '24h')}
                                />
                            </div>
                        </div>
                    </section>
                    {/* Account - Profile - Email */}
                    <section className="settings-card">
                        <header>
                            <h2>{t.account}</h2>
                            <p>{t.accountSub}</p>
                        </header>
                        <div className="settings-row">
                            <div>
                                <strong>{t.profileAction}</strong>
                                <p>{t.profileHint}</p>
                            </div>
                            <div className="settings-actions">
                                <Button
                                    type="button"
                                    variant="primary"
                                    onClick={() => redirectTo('/profile')}
                                >
                                    {t.editProfile}
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setPasswordOpen(true)}
                                >
                                    {t.changePassword}
                                </Button>
                            </div>
                        </div>
                        <div className="settings-row">
                            <div>
                                <strong>{t.email}</strong>
                                <p>{user?.email ?? '—'}</p>
                            </div>
                            <span className="settings-readonly">
                                {t.readOnly}
                            </span>
                        </div>
                    </section>
                </main>
                {/* 'Your account' Card */}
                <aside className="settings-aside">
                    <section className="settings-side-card">
                        <h2>{t.accountSummary}</h2>
                        <p>{t.accountSummaryText}</p>
                        <dl>
                            <div>
                                <dt>{t.role}</dt>
                                <dd>{role}</dd>
                            </div>
                            <div>
                                <dt>{t.created}</dt>
                                <dd>
                                    {profile?.created_at
                                        ? new Date(
                                              profile.created_at
                                          ).toLocaleDateString(locale)
                                        : '—'}
                                </dd>
                            </div>
                        </dl>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={reset}
                            icon={<RotateCcw size={14} aria-hidden="true" />}
                        >
                            {t.reset}
                        </Button>
                    </section>
                    <section className="settings-side-card settings-coming">
                        <div>
                            <Sun size={15} aria-hidden="true" />
                            <Moon size={15} aria-hidden="true" />
                        </div>
                        <h2>{t.comingSoon}</h2>
                        <p>{t.comingSoonText}</p>
                    </section>
                </aside>
            </div>
            {/* Change Password Modal */}
            <ChangePasswordModal
                open={passwordOpen}
                strings={parseChangePasswordStrings(
                    getTranslation(locale).auth
                )}
                onSuccess={() => setPasswordOpen(false)}
                onClose={() => setPasswordOpen(false)}
            />
            {/* Accessibility Note */}
            <span className="settings-a11y-note">
                <ShieldCheck size={14} aria-hidden="true" /> {t.localNote}
            </span>
        </div>
    );
}
