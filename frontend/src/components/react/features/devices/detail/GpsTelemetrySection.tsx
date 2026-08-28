//-- Types
import type { JSX } from 'react/jsx-runtime';
import type { LocationPoint } from '@/types/api';
import type { DeviceStatus } from '@/types/components';
import type { Language } from '@/types';
import type { Translation } from '@/i18n';
//-- Components
import {
    MapCard,
    TelemetryCard,
} from '@/components/react/features/devices/location';
import { GpsTelemetrySectionSkeleton } from '@/components/react/skeleton';

/**
 * Props for the GpsTelemetrySection component
 * @interface GpsTelemetrySectionProps
 * @prop {string} title - Title of the section.
 * @prop {string} description - Description of the section.
 * @prop {LocationPoint | null} latest - Latest location data.
 * @prop {Language} locale - Locale.
 * @prop {Translation['device']} translations - Translations.
 * @prop {Translation['date']} date - Date-related translation strings.
 * @prop {boolean} loading - Loading state.
 * @prop {string} deviceId - Device ID.
 * @prop {boolean} [showGoLive] - Whether to show the go live button.
 * @prop {() => Promise<void>} getLatestLocation - Function to get the latest location.
 */
interface GpsTelemetrySectionProps {
    title: string;
    description: string;
    latest: LocationPoint | null;
    locale: Language;
    translations: Translation['device'];
    date: Translation['date'];
    loading: boolean;
    deviceId: string;
    showGoLive?: boolean;
    getLatestLocation: (deviceId: string) => Promise<void>;
    routeSegments?: LocationPoint[][];
    displayStatus?: DeviceStatus;
    routeStyle?: 'line' | 'dots';
}
/**
 * The GPS telemetry section of the device detail page
 * @param {GpsTelemetrySectionProps} props - The props for the component
 * @returns {JSX.Element} The rendered component
 */
export function GpsTelemetrySection({
    title,
    description,
    latest,
    locale,
    translations,
    date,
    loading,
    deviceId,
    showGoLive = false,
    getLatestLocation,
    routeSegments,
    displayStatus,
    routeStyle,
}: GpsTelemetrySectionProps): JSX.Element {
    if (!latest) {
        return <GpsTelemetrySectionSkeleton />;
    }
    return (
        <section className="dd-section">
            <div className="dd-section-head">
                <div>
                    <h2>{title}</h2>
                    <div>{description}</div>
                </div>
            </div>
            <div className="dd-map-grid">
                <MapCard
                    location={latest}
                    locale={locale}
                    translations={translations}
                    date={date}
                    loading={loading}
                    deviceId={deviceId}
                    showGoLive={showGoLive}
                    onRefresh={() => {
                        if (deviceId) void getLatestLocation(deviceId);
                    }}
                    routeSegments={routeSegments}
                    displayStatus={displayStatus}
                    routeStyle={routeStyle}
                />
                <TelemetryCard
                    location={latest}
                    locale={locale}
                    translations={translations}
                    date={date}
                />
            </div>
        </section>
    );
}
