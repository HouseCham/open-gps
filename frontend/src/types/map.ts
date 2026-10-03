import type { ApiError } from './api';

/**
 * Interface for a GeoJSON object representing a route
 * @interface RouteGeoJson
 * @property {string} type - The type of the GeoJSON object
 * @property {GeoJsonFeature[]} features - The features of the GeoJSON object
 */
export interface RouteGeoJson {
    type: 'FeatureCollection';
    features: GeoJsonFeature[];
}
/**
 * Represents a GeoJSON feature for a route
 * @interface GeoJsonFeature
 * @property {string} type - The type of the GeoJSON feature
 * @property {Record<string, never>} properties - The properties of the GeoJSON feature
 */
export interface GeoJsonFeature {
    type: 'Feature';
    properties: Record<string, never>;
    geometry: GeoJsonGeometry;
}
/**
 * Represents usage of a GeoJSON geometry for a route
 * @interface GeoJsonGeometry
 * @property {string} type - The type of the GeoJSON geometry
 * @property {number[][]} coordinates - The coordinates of the GeoJSON geometry
 */
export interface GeoJsonGeometry {
    type: 'LineString';
    coordinates: number[][];
}
/**
 * Interface for the options used in a location request
 * @interface LocationRequestOptions
 * @template T - The type of the data expected in the response
 * @property {() => Promise<unknown>} request - The function to execute the request
 * @property {(loading: boolean) => void} setLoading - Function to set the loading state
 * @property {(error: ApiError | null) => void} setError - Function to set the error state
 * @property {(data: T) => void} onSuccess - Function to handle successful response data
 * @property {boolean} [notify=true] - Whether to notify on success or error (default: true)
 * @property {(status: number) => boolean} [onStatus] - Optional function to handle specific status codes
 */
export interface LocationRequestOptions<T> {
    request: () => Promise<unknown>;
    setLoading: (loading: boolean) => void;
    setError: (error: ApiError | null) => void;
    onSuccess: (data: T) => void;
    notify?: boolean;
    onStatus?: (status: number) => boolean;
}
