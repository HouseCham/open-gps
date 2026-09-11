import '@/styles/settings.css';
import { useState, type ChangeEvent, type JSX } from 'react';
//-- Stores
import { useStore } from '@nanostores/react';
import { $profile, $user } from '@/lib/stores/auth';
//-- Hooks
import { useTheme, type Theme } from '@/lib/hooks/useTheme';
//-- I18n
import { getTranslation, type Translation } from '@/i18n';
//-- Utils
import { parseChangePasswordStrings, readSettingsPreferences } from '@/lib';
//-- Types
import type { Language, Settings } from '@/types';
//-- Constants
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/constants';
//-- Components
import { ChangePasswordModal } from '@/components/react/modal';
import { Button } from '@/components/react/ui/button';
import { SettingsChoice } from './SettingsChoice';
//-- Icons
import { Moon, RotateCcw, ShieldCheck, Sun } from 'lucide-react';
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
    const [preferences, setPreferences] =
        useState<Settings>(readSettingsPreferences);
    const [passwordOpen, setPasswordOpen] = useState(false);
    /**
     * Update a setting
     * @param {keyof Settings} key - The key of the setting to update.
     * @param {Settings[keyof Settings]} value - The value of the setting to update.
     * @returns {void} 
     */
    const update = <K extends keyof Settings>(
        key: K,
        value: Settings[K]
    ): void => {
        const next = { ...preferences, [key]: value };
        setPreferences(next);
        try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
        } catch (error) {
            console.warn('Unable to save settings to local storage.', error);
        }
    };
    /**
     * Reset the settings to the default values
     * @returns {void}
     */
    const reset = (): void => {
        setPreferences(DEFAULT_SETTINGS);
        setTheme('light');
        try {
            localStorage.removeItem(SETTINGS_STORAGE_KEY);
        } catch (error) {
            console.warn('Unable to clear saved settings from local storage.', error);
        }
    };
    // The select options are restricted to the Theme union values above.
    const role = profile?.role === 'super_admin' ? t.superAdmin : t.user;
    /**
     * Handle theme change
     * @param {ChangeEvent<HTMLSelectElement>} event - The change event from the select element.
     * @returns {void}
     */
    const changeTheme = (event: ChangeEvent<HTMLSelectElement>): void => {
        // The select options are restricted to the Theme union values above.
        setTheme(event.target.value as Theme);
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
                                    onClick={() =>
                                        (window.location.href =
                                            window.location.pathname.replace(
                                                /^\/(en|es)/,
                                                '/es'
                                            ))
                                    }
                                >
                                    Español
                                </Button>
                                <Button
                                    type="button"
                                    variant={
                                        locale === 'en'
                                            ? 'primary'
                                            : 'secondary'
                                    }
                                    onClick={() =>
                                        (window.location.href =
                                            window.location.pathname.replace(
                                                /^\/(en|es)/,
                                                '/en'
                                            ))
                                    }
                                >
                                    English
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
                                    checked={preferences.sidebar === 'open'}
                                    onChange={() => update('sidebar', 'open')}
                                />
                                <SettingsChoice
                                    name="sidebar"
                                    value="closed"
                                    label={t.collapsed}
                                    checked={preferences.sidebar === 'closed'}
                                    onChange={() => update('sidebar', 'closed')}
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
                                    checked={preferences.motion}
                                    onChange={event =>
                                        update('motion', event.target.checked)
                                    }
                                />
                                <span>{preferences.motion ? t.on : t.off}</span>
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
                                value={preferences.history}
                                onChange={event =>
                                    update('history', event.target.value)
                                }
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
                                value={preferences.landing}
                                onChange={event =>
                                    update('landing', event.target.value)
                                }
                                aria-label={t.landing}
                            >
                                <option value="dashboard">{t.dashboard}</option>
                                <option value="devices">{t.devices}</option>
                            </select>
                        </div>
                        <div className="settings-row">
                            <div>
                                <strong>{t.density}</strong>
                                <p>{t.densityHint}</p>
                            </div>
                            <div className="settings-segmented">
                                <SettingsChoice
                                    name="density"
                                    value="comfortable"
                                    label={t.comfortable}
                                    checked={
                                        preferences.density === 'comfortable'
                                    }
                                    onChange={() =>
                                        update('density', 'comfortable')
                                    }
                                />
                                <SettingsChoice
                                    name="density"
                                    value="compact"
                                    label={t.compact}
                                    checked={preferences.density === 'compact'}
                                    onChange={() =>
                                        update('density', 'compact')
                                    }
                                />
                            </div>
                        </div>
                    </section>
                    {/* Region - Timezone - Units - Time format */}
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
                                value={preferences.timezone}
                                onChange={event =>
                                    update('timezone', event.target.value)
                                }
                                aria-label={t.timezone}
                            >
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
                                <strong>{t.units}</strong>
                                <p>{t.unitsHint}</p>
                            </div>
                            <div className="settings-segmented">
                                <SettingsChoice
                                    name="units"
                                    value="metric"
                                    label={t.metric}
                                    checked={preferences.units === 'metric'}
                                    onChange={() => update('units', 'metric')}
                                />
                                <SettingsChoice
                                    name="units"
                                    value="imperial"
                                    label={t.imperial}
                                    checked={preferences.units === 'imperial'}
                                    onChange={() => update('units', 'imperial')}
                                />
                            </div>
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
                                    checked={preferences.hours === '12'}
                                    onChange={() => update('hours', '12')}
                                />
                                <SettingsChoice
                                    name="hours"
                                    value="24"
                                    label={t.hours24}
                                    checked={preferences.hours === '24'}
                                    onChange={() => update('hours', '24')}
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
                                    onClick={() =>
                                        (window.location.href = `/${locale}/profile`)
                                    }
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
            />
            {/* Accessibility Note */}
            <span className="settings-a11y-note">
                <ShieldCheck size={14} aria-hidden="true" /> {t.localNote}
            </span>
        </div>
    );
}
