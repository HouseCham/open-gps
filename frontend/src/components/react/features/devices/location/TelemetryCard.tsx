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
 */
interface TelemetryCardProps {
    location: LocationPoint | null;
    locale: Language;
    translations: Translation['device'];
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
            <div className="dd-card-head">
                <div>
                    <h3>{t.telemetry.title}</h3>
                    <div className="dd-card-sub">{t.telemetry.subtitle}</div>
                </div>
            </div>
            <div className="dd-card-body">
                {location ? (
                    <>
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
