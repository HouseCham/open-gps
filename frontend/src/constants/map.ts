// ---------------------------------------------------------------------------
// Accuracy threshold: points worse than this (in metres) are excluded from
// the rendered path.  Tune to taste — 20 m is a reasonable default for
// consumer-grade GPS hardware.
// ---------------------------------------------------------------------------
export const MAP_MAX_ACCURACY_M = 20;

// ---------------------------------------------------------------------------
// Minimum distance (in degrees, ~1 m at the equator) between consecutive
// points before we skip the duplicate.  Avoids rendering a "cluster" of
// stationary readings as a zigzag.
// ---------------------------------------------------------------------------
export const MAP_MIN_DELTA_DEG = 0.000009; // ≈ 1 m

// ---------------------------------------------------------------------------
// Map projection constants.
// ---------------------------------------------------------------------------
export const MAP_PROJECTION_LAT_MIN = -60;
export const MAP_PROJECTION_LAT_MAX = 75;
export const MAP_PROJECTION_LONGITUDE_OFFSET = 180;
export const MAP_PROJECTION_LONGITUDE_RANGE = 360;
export const MAP_PROJECTION_GRID_SIZE = 100;
