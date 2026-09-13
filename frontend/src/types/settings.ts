/**
 * The values supported by browser-local application preferences.
 */
export type SidebarInitialState = 'expanded' | 'collapsed';
export type DefaultHistoryRange = '1h' | '6h' | '24h' | '7d';
export type LandingPage = 'dashboard' | 'devices';
export type TableDensity = 'comfortable' | 'compact';
export type UnitSystem = 'metric' | 'imperial';
export type TimeFormat = '12h' | '24h';

/**
 * Browser-local settings. Theme and locale are intentionally managed by their
 * existing URL and theme contracts rather than duplicated here.
 */
export interface LocalSettings {
    sidebarInitialState: SidebarInitialState;
    reduceMotion: boolean;
    defaultHistoryRange: DefaultHistoryRange;
    landingPage: LandingPage;
    tableDensity: TableDensity;
    timeZone: string;
    unitSystem: UnitSystem;
    timeFormat: TimeFormat;
}
