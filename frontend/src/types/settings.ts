/**
 * Settings for the app
 * @interface Settings
 * @prop {string} history - The history setting.
 * @prop {string} landing - The landing page setting.
 * @prop {'comfortable' | 'compact'} density - The density setting.
 * @prop {string} timezone - The timezone setting.
 * @prop {'metric' | 'imperial'} units - The units setting.
 * @prop {'12' | '24'} hours - The hours setting.
 * @prop {'open' | 'closed'} sidebar - The sidebar setting.
 * @prop {boolean} motion - The motion setting.
 */
export interface Settings {
    history: string;
    landing: string;
    density: 'comfortable' | 'compact';
    timezone: string;
    units: 'metric' | 'imperial';
    hours: '12' | '24';
    sidebar: 'open' | 'closed';
    motion: boolean;
}