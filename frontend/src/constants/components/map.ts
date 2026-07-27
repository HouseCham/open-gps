import type {
    DeviceMapPin,
    DeviceMapRoutePoint,
    MarkerStatus,
    RouteSpeed,
} from '@/types/components';
/**
 * @constant MAP_STATUS_CLASS
 * @description Class names for the map status markers
 */
export const MAP_STATUS_CLASS: Record<MarkerStatus, string> = {
    online: 'map-popover__badge--online',
    offline: 'map-popover__badge--offline',
    'never-seen': 'map-popover__badge--warning',
    unknown: 'map-popover__badge--muted',
};
/**
 * @constant MAP_DEMO_PINS
 * @description Demo pins for the map
 */
export const MAP_DEMO_PINS: DeviceMapPin[] = [
    {
        id: 'D-001',
        name: 'Delivery Van #3',
        status: 'online',
        lat: 19.4326,
        lng: -99.1332,
        lastSeen: new Date(Date.now() - 2 * 60000).toISOString(),
    },
    {
        id: 'D-002',
        name: 'Fleet Unit #7',
        status: 'online',
        lat: 29.62,
        lng: -99.15,
        lastSeen: new Date(Date.now() - 8 * 60000).toISOString(),
    },
    {
        id: 'D-003',
        name: 'Cargo Truck #12',
        status: 'online',
        lat: 39.445,
        lng: -99.115,
        lastSeen: new Date(Date.now() - 1 * 60000).toISOString(),
    },
    {
        id: 'D-004',
        name: 'Service Van #2',
        status: 'offline',
        lat: 49.405,
        lng: -99.16,
        lastSeen: new Date(Date.now() - 4 * 3600000).toISOString(),
    },
    {
        id: 'D-005',
        name: 'ESP32-A4:CF:12',
        status: 'never-seen',
        lat: 59.438,
        lng: -99.1,
        lastSeen: null,
    },
];
/**
 * @constant MAP_DEMO_ROUTE
 * @description Demo route for the map
 */
export const MAP_DEMO_ROUTE: DeviceMapRoutePoint[] = [
    { lat: 19.405, lng: -99.16 },
    { lat: 19.41, lng: -99.15 },
    { lat: 19.42, lng: -99.145 },
    { lat: 19.425, lng: -99.138 },
    { lat: 19.4326, lng: -99.1332 },
];
/**
 * @constant MAP_SPEED_OPTIONS
 * @description Speed options for the map
 */
export const MAP_SPEED_OPTIONS: RouteSpeed[] = [1, 2, 4];
/**
 * @constant {string}
 * @description Default map style URL
 */
const DEFAULT_MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
/**
 * @constant {string}
 * @description Map style URL
 */
export const MAP_STYLE_URL: string =
    // in case the env var is not set, fallback to the default style
    (import.meta.env.PUBLIC_MAP_STYLE_URL as string | undefined) ??
    DEFAULT_MAP_STYLE;
/**
 * @constant {number}
 * @description Online threshold in milliseconds. A reading older than
 * this is treated as "disconnected" — drives both the map marker
 * status (DeviceMapLive.statusFromRecordedAt) and the device-detail
 * header badge. Shared threshold so the two indicators never drift.
 */
export const MAP_ONLINE_THRESHOLD_MS = 60 * 1000;
/**
 * @constant {string}
 * @description Stroke color for the route polyline drawn on the live device map.
 */
export const MAP_ROUTE_LINE_COLOR = '#1a73e8';
/**
 * @constant {number}
 * @description Default center and zoom for the map
 */
export const MAP_FALLBACK_CENTER = { latitude: 19.4326, longitude: -99.1332 };
/**
 * @constant {number}
 * @description Default zoom for the map
 */
export const MAP_FALLBACK_ZOOM = 4;
/**
 * @constant {number}
 * @description Default zoom for the map
 */
export const MAP_DEVICE_ZOOM = 15;
/**
 * @constant {number}
 * @description Default duration for the map animation
 */
export const MAP_EASE_TO_DURATION_MS = 1200;
/**
 * @constant {number}
 * @description Default size for the map refresh icon
 */
export const MAP_REFRESH_ICON_SIZE = 13;
/**
 * @constant {number}
 * @description Default decimal precision for map coordinates
 */
export const MAP_COORDINATE_DECIMALS = 4;
/**
 * @constant {number}
 * @description Default size for the map empty state icon
 */
export const MAP_EMPTY_STATE_ICON_SIZE = 26;