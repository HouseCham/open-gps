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
