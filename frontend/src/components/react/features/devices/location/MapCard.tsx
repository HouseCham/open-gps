//-- Types
import type { Translation } from '@/i18n';
import type { LocationPoint } from '@/types/api';
import type { DeviceStatus } from '@/types/components';
import type { Language } from '@/types/i18n';
import type { JSX } from 'react/jsx-runtime';
//-- Components
import { Button } from '@/components/react/ui/button';
import {
    Map as MapLibreMap,
    Layer,
    type MapRef,
    Marker,
    NavigationControl,
    ScaleControl,
    Source,
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
//-- Icons
import { MapPin, Radio, RefreshCw } from 'lucide-react';
//-- Utils
import { useEffect, useRef } from 'react';
import { deriveDeviceStatus, formatRelativeTime, redirectTo } from '@/lib';
import {
    MAP_COORDINATE_DECIMALS,
    MAP_DEVICE_ZOOM,
    MAP_EASE_TO_DURATION_MS,
    MAP_EMPTY_STATE_ICON_SIZE,
    MAP_FALLBACK_CENTER,
    MAP_FALLBACK_ZOOM,
    MAP_GO_LIVE_ICON_SIZE,
    MAP_REFRESH_ICON_SIZE,
    MAP_STYLE_URL,
    ROUTE_COLOR_OFFLINE,
    ROUTE_COLOR_ONLINE,
} from '@/constants/components';

interface RouteGeoJson {
    type: 'FeatureCollection';
    features: {
        type: 'Feature';
        properties: Record<string, never>;
        geometry: {
            type: 'LineString';
            coordinates: number[][];
        };
    }[];
}

/**
 * Props for the MapCard component
 * @interface MapCardProps
 * @prop {LocationPoint | null} location - Location details.
 * @prop {Language} locale - Locale.
 * @prop {Translation['device']} translations - Translations.
 * @prop {Translation['date']} date - Date-related translation strings.
 * @prop {boolean} loading - Loading state.
 * @prop {() => void} onRefresh - Callback for the refresh button.
 * @prop {string} deviceId - Device ID.
 * @prop {boolean} showGoLive - Whether to show the go live button.
 * @prop {LocationPoint[][]} routeSegments - Chronological route segments.
 * @prop {DeviceStatus} displayStatus - Optional status override for a selected range.
 */
interface MapCardProps {
    location: LocationPoint | null;
    locale: Language;
    translations: Translation['device'];
    date: Translation['date'];
    loading: boolean;
    deviceId: string;
    showGoLive: boolean;
    onRefresh: () => void;
    routeSegments?: LocationPoint[][];
    displayStatus?: DeviceStatus;
    routeStyle?: 'line' | 'dots';
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
    date,
    loading,
    deviceId,
    showGoLive,
    onRefresh,
    routeSegments = [],
    displayStatus,
    routeStyle = 'line',
}: MapCardProps): JSX.Element {
    const t = translations.detail;
    const hasLocation = location !== null;
    const center = hasLocation
        ? { latitude: location.latitude, longitude: location.longitude }
        : MAP_FALLBACK_CENTER;
    const mapRef = useRef<MapRef | null>(null);
    const status =
        displayStatus ??
        deriveDeviceStatus(location?.recorded_at ?? null, translations);
    const routeData: RouteGeoJson = {
        type: 'FeatureCollection',
        features: routeSegments.map(segment => ({
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: segment.map(point => [
                    point.longitude,
                    point.latitude,
                ]),
            },
        })),
    };
    const routeColor =
        status.key === 'online' ? ROUTE_COLOR_ONLINE : ROUTE_COLOR_OFFLINE;
    const routePoints = routeSegments.flat();
    const routePointsData = {
        type: 'FeatureCollection' as const,
        features: routePoints.map(point => ({
            type: 'Feature' as const,
            properties: {},
            geometry: {
                type: 'Point' as const,
                coordinates: [point.longitude, point.latitude],
            },
        })),
    };
    const routeKey = routePoints.map(point => point.recorded_at).join('|');

    // initialViewState only applies on first mount; fit the selected route
    // after its data arrives so the entire path remains visible.
    useEffect(() => {
        if (routePoints.length > 1) {
            const first = routePoints[0];
            if (!first) return;
            const bounds: [[number, number], [number, number]] = [
                [first.longitude, first.latitude],
                [first.longitude, first.latitude],
            ];
            routePoints.slice(1).forEach(point => {
                bounds[0][0] = Math.min(bounds[0][0], point.longitude);
                bounds[0][1] = Math.min(bounds[0][1], point.latitude);
                bounds[1][0] = Math.max(bounds[1][0], point.longitude);
                bounds[1][1] = Math.max(bounds[1][1], point.latitude);
            });
            mapRef.current?.fitBounds(bounds, {
                padding: 48,
                duration: MAP_EASE_TO_DURATION_MS,
            });
            return;
        }
        if (!hasLocation) return;
        mapRef.current?.easeTo({
            center: [location.longitude, location.latitude],
            zoom: MAP_DEVICE_ZOOM,
            duration: MAP_EASE_TO_DURATION_MS,
        });
    }, [hasLocation, location?.latitude, location?.longitude, routeKey]);

    return (
        <div className="dd-card">
            {/* Card header */}
            <div className="dd-card-head">
                {/* Title */}
                <div>
                    <h3>{t.liveGps}</h3>
                    <div className="dd-card-sub">
                        {location
                            ? `${t.latestReading} · ${formatRelativeTime(location.recorded_at, locale, date)}`
                            : t.noLocation}
                    </div>
                </div>
                {/* Refresh + Go Live actions */}
                <div className="dd-card-head-actions">
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
                    {/* Go live / stop live button */}
                    {showGoLive && (
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className={'dd-go-live-active'}
                            icon={<Radio size={MAP_GO_LIVE_ICON_SIZE} />}
                            onClick={() =>
                                redirectTo(`/devices/live?id=${deviceId}`)
                            }
                        >
                            {t.goLive}
                        </Button>
                    )}
                </div>
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
                    {routeSegments.length > 0 && routeStyle === 'line' && (
                        <Source
                            id="device-route"
                            type="geojson"
                            data={routeData}
                        >
                            <Layer
                                id="device-route-line"
                                type="line"
                                layout={{
                                    'line-cap': 'round',
                                    'line-join': 'round',
                                }}
                                paint={{
                                    'line-color': routeColor,
                                    'line-opacity': 0.85,
                                    'line-width': 3,
                                }}
                            />
                        </Source>
                    )}
                    {routePoints.length > 0 && routeStyle === 'dots' && (
                        <Source
                            id="device-route-dots"
                            type="geojson"
                            data={routePointsData}
                        >
                            <Layer
                                id="device-route-points"
                                type="circle"
                                paint={{
                                    'circle-color': routeColor,
                                    'circle-radius': 4,
                                    'circle-stroke-color': '#ffffff',
                                    'circle-stroke-width': 1,
                                }}
                            />
                        </Source>
                    )}
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
                            <div
                                className={`dd-marker${status.dot === 'success' ? '' : ' dd-marker--disconnected'}`}
                                aria-hidden="true"
                            >
                                {status.dot === 'success' && (
                                    <span className="dd-marker-pulse" />
                                )}
                                <span className="dd-marker-dot" />
                            </div>
                        </Marker>
                    )}
                </MapLibreMap>
                {hasLocation && (
                    <div className="dd-map-coords">
                        {location.latitude.toFixed(MAP_COORDINATE_DECIMALS)}°,{' '}
                        {location.longitude.toFixed(MAP_COORDINATE_DECIMALS)}°
                    </div>
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
