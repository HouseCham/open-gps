import '@/styles/device-detail.css';
import '@/styles/gps-telemetry-skeleton.css';
//-- Types
import type { JSX } from 'react/jsx-runtime';
//-- Components
import { Skeleton } from '@/components/react/ui/Skeleton';

const TELEMETRY_ITEMS = 6;

/**
 * Loading placeholder for the GPS telemetry section.
 * @returns {JSX.Element} The rendered GPS telemetry skeleton.
 */
export function GpsTelemetrySectionSkeleton(): JSX.Element {
    return (
        <section
            className="dd-section"
            aria-busy="true"
            aria-label="Loading GPS telemetry"
        >
            <div className="dd-section-head">
                <div>
                    <Skeleton variant="text" width="180px" />
                    <Skeleton
                        variant="text-sm"
                        width="280px"
                        className="gps-telemetry-skeleton__subtitle"
                    />
                </div>
            </div>

            <div className="dd-map-grid">
                <div className="dd-card">
                    <div className="dd-card-head">
                        <div>
                            <Skeleton variant="text" width="120px" />
                            <Skeleton
                                variant="text-sm"
                                width="150px"
                                className="gps-telemetry-skeleton__subtitle"
                            />
                        </div>
                        <div className="gps-telemetry-skeleton__actions">
                            <Skeleton
                                variant="block"
                                width="72px"
                                height="28px"
                            />
                            <Skeleton
                                variant="block"
                                width="82px"
                                height="28px"
                            />
                        </div>
                    </div>
                    <div className="dd-map" aria-hidden="true">
                        <div className="dd-map-canvas" />
                        <Skeleton
                            variant="block"
                            className="gps-telemetry-skeleton__map-marker"
                        />
                    </div>
                </div>

                <div className="dd-card">
                    <div className="dd-card-head">
                        <div>
                            <Skeleton variant="text" width="130px" />
                            <Skeleton
                                variant="text-sm"
                                width="180px"
                                className="gps-telemetry-skeleton__subtitle"
                            />
                        </div>
                    </div>
                    <div className="dd-card-body">
                        <div className="dd-coordinates">
                            <Skeleton
                                variant="block"
                                width="16px"
                                height="16px"
                            />
                            <Skeleton variant="text-sm" width="100px" />
                            <Skeleton variant="text-sm" width="100px" />
                        </div>
                        <div className="dd-telemetry-grid">
                            {Array.from(
                                { length: TELEMETRY_ITEMS },
                                (_, index) => (
                                    <div
                                        className="dd-telemetry-cell"
                                        key={index}
                                    >
                                        <Skeleton
                                            variant="block"
                                            width="28px"
                                            height="28px"
                                        />
                                        <span className="gps-telemetry-skeleton__metric">
                                            <Skeleton
                                                variant="text-sm"
                                                width="60px"
                                            />
                                            <Skeleton
                                                variant="text"
                                                width="72px"
                                            />
                                        </span>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
