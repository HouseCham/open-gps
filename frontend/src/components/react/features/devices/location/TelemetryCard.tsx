import type { Translation } from '@/i18n';
import { formatRelativeTime, renderNumberWithUnit } from '@/lib';
import type { LocationPoint } from '@/types/api';
import type { Language } from '@/types/i18n';
import {
    Battery,
    Clock3,
    Crosshair,
    Gauge,
    Mountain,
    Signal,
} from 'lucide-react';
import type { JSX } from 'react/jsx-runtime';
/**
 * Props for the TelemetryCard component
 * @interface TelemetryCardProps
 * @prop {LocationPoint | null} location - Location details.
 * @prop {Language} locale - Locale.
 * @prop {Translation['device']} translations - Translations.
 * @prop {LocationPoint[]} liveEntries - Log of points polled while live mode is on.
 * @prop {boolean} liveMode - Whether live polling is currently active.
 */
interface TelemetryCardProps {
    location: LocationPoint | null;
    locale: Language;
    translations: Translation['device'];
    liveEntries: LocationPoint[];
    liveMode: boolean;
}
/**
 * Shows telemetry information for a device.
 * @param {LocationPoint | null} location - Location details.
 * @param props - Component props.
 * @returns {JSX.Element} - The rendered component.
 */
export function TelemetryCard({
    location,
    locale,
    translations,
    liveEntries,
    liveMode,
}: TelemetryCardProps): JSX.Element {
    const t = translations.detail;
    const items = location
        ? [
              {
                  icon: <Mountain size={14} />,
                  label: t.telemetry.altitude,
                  value: renderNumberWithUnit(
                      location.altitude,
                      t.units.meters
                  ),
              },
              {
                  icon: <Gauge size={14} />,
                  label: t.telemetry.speed,
                  value: renderNumberWithUnit(location.speed, t.units.speed, 1),
              },
              {
                  icon: <Crosshair size={14} />,
                  label: t.telemetry.accuracy,
                  value:
                      location.accuracy == null
                          ? '—'
                          : `±${location.accuracy.toFixed(1)} ${t.units.meters}`,
              },
              {
                  icon: <Battery size={14} />,
                  label: t.telemetry.battery,
                  value: renderNumberWithUnit(location.battery_voltage, 'V', 2),
              },
              {
                  icon: <Signal size={14} />,
                  label: t.telemetry.signal,
                  value:
                      location.signal_strength == null
                          ? '—'
                          : `${location.signal_strength}/31`,
              },
              {
                  icon: <Clock3 size={14} />,
                  label: t.telemetry.recorded,
                  value: formatRelativeTime(location.recorded_at, locale),
              },
          ]
        : [];

    return (
        <div className="dd-card">
            {/* Card header */}
            <div className="dd-card-head">
                <div>
                    <h3>{t.telemetry.title}</h3>
                    <div className="dd-card-sub">{t.telemetry.subtitle}</div>
                </div>
            </div>
            {/* Card body */}
            <div className="dd-card-body">
                {location ? (
                    <>
                        {/* Coordinates */}
                        <div className="dd-coordinates">
                            <Crosshair size={15} />
                            <span>
                                <small>{t.latitude}</small>
                                {location.latitude.toFixed(6)}
                            </span>
                            <span>
                                <small>{t.longitude}</small>
                                {location.longitude.toFixed(6)}
                            </span>
                        </div>
                        {/* Telemetry grid */}
                        <div className="dd-telemetry-grid">
                            {items.map(item => (
                                <div
                                    className="dd-telemetry-cell"
                                    key={item.label}
                                >
                                    <span className="dd-telemetry-icon">
                                        {item.icon}
                                    </span>
                                    <span>
                                        <small>{item.label}</small>
                                        <strong>{item.value}</strong>
                                    </span>
                                </div>
                            ))}
                        </div>
                        {/* Live mode location entries */}
                        {liveMode && (
                            <div className="dd-live-entries">
                                {liveEntries.length === 0 ? (
                                    <div className="dd-live-entries-empty">
                                        {t.liveWaiting}
                                    </div>
                                ) : (
                                    liveEntries.map((entry, i) => (
                                        <div
                                            className="dd-coordinates dd-coordinates--live"
                                            key={`${entry.recorded_at}-${i}`}
                                        >
                                            <Crosshair size={15} />
                                            <span>
                                                <small>{t.latitude}</small>
                                                {entry.latitude.toFixed(6)}
                                            </span>
                                            <span>
                                                <small>{t.longitude}</small>
                                                {entry.longitude.toFixed(6)}
                                            </span>
                                            <span className="dd-live-entries-time">
                                                {formatRelativeTime(
                                                    entry.recorded_at,
                                                    locale
                                                )}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="dd-card-empty">
                        {t.noLocationDescription}
                    </div>
                )}
            </div>
        </div>
    );
}
