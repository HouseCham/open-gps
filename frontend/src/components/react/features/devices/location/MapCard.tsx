//-- Types
import type { Translation } from '@/i18n';
import type { LocationPoint } from '@/types/api';
import type { Language } from '@/types/i18n';
import type { JSX } from 'react/jsx-runtime';
//-- Components
import { Button } from '@/components/react/ui/button';
import {
    Map as MapLibreMap,
    type MapRef,
    Marker,
    NavigationControl,
    ScaleControl,
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
//-- Icons
import { MapPin, RefreshCw } from 'lucide-react';
//-- Utils
import { useEffect, useRef } from 'react';
import { formatRelativeTime } from '@/lib';
import { MAP_COORDINATE_DECIMALS, MAP_DEVICE_ZOOM, MAP_EASE_TO_DURATION_MS, MAP_EMPTY_STATE_ICON_SIZE, MAP_FALLBACK_CENTER, MAP_FALLBACK_ZOOM, MAP_REFRESH_ICON_SIZE, MAP_STYLE_URL } from '@/constants/components';

/**
 * Props for the MapCard component
 * @interface MapCardProps
 * @prop {LocationPoint | null} location - Location details.
 * @prop {Language} locale - Locale.
 * @prop {Translation['device']} translations - Translations.
 * @prop {boolean} loading - Loading state.
 * @prop {() => void} onRefresh - Callback for the refresh button.
 */
interface MapCardProps {
    location: LocationPoint | null;
    locale: Language;
    translations: Translation['device'];
    loading: boolean;
    onRefresh: () => void;
}
/**
 * MapCard component
 * @param {MapCardProps} props - Props for the MapCard component
 * @returns {JSX.Element} The rendered MapCard component
 */
export function MapCard({
    location,
    locale,
    translations,
    loading,
    onRefresh,
}: MapCardProps): JSX.Element {
    const t = translations.detail;
    const hasLocation = location !== null;
    const center = hasLocation
        ? { latitude: location.latitude, longitude: location.longitude }
        : MAP_FALLBACK_CENTER;
    const mapRef = useRef<MapRef | null>(null);

    // ponytail: initialViewState only applies on first mount; the device
    // location usually arrives *after* that. Animate to it once data loads.
    useEffect(() => {
        if (!hasLocation) return;
        mapRef.current?.easeTo({
            center: [location.longitude, location.latitude],
            zoom: MAP_DEVICE_ZOOM,
            duration: MAP_EASE_TO_DURATION_MS,
        });
    }, [hasLocation, location?.latitude, location?.longitude]);

    return (
        <div className="dd-card">
            {/* Card header */}
            <div className="dd-card-head">
                {/* Title */}
                <div>
                    <h3>{t.liveGps}</h3>
                    <div className="dd-card-sub">
                        {location
                            ? `${t.latestReading} · ${formatRelativeTime(location.recorded_at, locale)}`
                            : t.noLocation}
                    </div>
                </div>
                {/* Refresh button */}
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={loading}
                    icon={<RefreshCw size={MAP_REFRESH_ICON_SIZE} />}
                    onClick={onRefresh}
                >
                    {t.refresh}
                </Button>
            </div>
            <div className="dd-map" aria-label={t.mapLabel}>
                <MapLibreMap
                    ref={mapRef}
                    mapStyle={MAP_STYLE_URL}
                    initialViewState={{
                        ...center,
                        zoom: hasLocation ? MAP_DEVICE_ZOOM : MAP_FALLBACK_ZOOM,
                        pitch: 0,
                        bearing: 0,
                    }}
                    attributionControl={{ compact: true }}
                    dragRotate={false}
                    pitchWithRotate={false}
                    touchPitch={false}
                    boxZoom={false}
                >
                    <NavigationControl
                        position="top-right"
                        visualizePitch={false}
                    />
                    <ScaleControl position="bottom-left" unit="metric" />
                    {hasLocation && (
                        <Marker
                            latitude={location.latitude}
                            longitude={location.longitude}
                            anchor="center"
                        >
                            <div className="dd-marker" aria-hidden="true">
                                <span className="dd-marker-pulse" />
                                <span className="dd-marker-dot" />
                            </div>
                        </Marker>
                    )}
                </MapLibreMap>
                {hasLocation && (
                    <>
                        <div className="dd-map-live">
                            <span className="dd-map-live-dot" />
                            {t.liveTracking}
                        </div>
                        <div className="dd-map-coords">
                            {location.latitude.toFixed(MAP_COORDINATE_DECIMALS)}°,{' '}
                            {location.longitude.toFixed(MAP_COORDINATE_DECIMALS)}°
                        </div>
                    </>
                )}
                {!hasLocation && (
                    <div className="dd-map-empty">
                        <MapPin size={MAP_EMPTY_STATE_ICON_SIZE} />
                        <span>{t.noLocation}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
