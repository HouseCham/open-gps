//-- Types
import type { Translation } from '@/i18n';
import type { Language } from '@/types';
import type { DeviceDetail, LocationPoint } from '@/types/api';
import type { DeviceStatus } from '@/types/components';
import type { JSX, ReactNode } from 'react';
//-- Icons
import { Battery, Signal, Gauge, Clock3 } from 'lucide-react';
import { clampValue, formatDateTime, formatRelativeTime } from '@/lib';
import { getVehicleBatteryMetricTone } from '@/lib/features';
/**
 * Props for the KpiCard component
 * @interface KpiCardProps
 * @prop {ReactNode} icon - Icon shown centered above the title.
 * @prop {string} label - Title text.
 * @prop {string} value - Optional supporting copy.
 * @prop {string} hint - Optional supporting copy.
 * @prop {number} percent - Optional supporting copy.
 * @prop {'ok' | 'warn' | 'bad' | ''} tone - Optional supporting copy.
 */
interface KpiCardProps {
    icon: ReactNode;
    label: string;
    value: string;
    hint: string;
    percent: number | null;
    tone: 'ok' | 'warn' | 'bad' | '';
}
/**
 * KpiCard component
 * @param {KpiCardProps} props - Props for the KpiCard component.
 * @returns {JSX.Element} The rendered KpiCard component.
 */
export function KpiCard({
    icon,
    label,
    value,
    hint,
    percent,
    tone,
}: KpiCardProps): JSX.Element {
    return (
        <div className="dd-kpi-card">
            <div className="dd-kpi-head">
                {icon}
                {label}
            </div>
            <div className="dd-kpi-value">{value}</div>
            <div className="dd-kpi-foot">
                <div className="dd-kpi-bar" aria-hidden="true">
                    <span
                        className={`dd-kpi-bar-fill${tone ? ` is-${tone}` : ''}`}
                        style={{ width: `${percent ?? 0}%` }}
                    />
                </div>
                <span>{hint}</span>
            </div>
        </div>
    );
}

/**
 * Props for the KpiStrip component
 * @interface KpiStripProps
 * @prop {DeviceDetail} device - Device details.
 * @prop {LocationPoint | null} location - Location details.
 * @prop {DeviceStatus} status - Device status.
 * @prop {Language} locale - Locale.
 * @prop {Translation['device']} translations - Translations.
 * @prop {Translation['date']} date - Date-related translation strings.
 */
interface KpiStripProps {
    device: DeviceDetail;
    location: LocationPoint | null;
    status: DeviceStatus;
    locale: Language;
    translations: Translation['device'];
    date: Translation['date'];
}
/**
 * KpiStrip component
 * @param {KpiStripProps} props - Props for the KpiStrip component.
 * @returns {JSX.Element} The rendered KpiStrip component.
 */
export function KpiStrip({
    device,
    location,
    status,
    locale,
    translations,
    date,
}: KpiStripProps): JSX.Element {
    const t = translations.detail;
    const batteryPercent =
        location?.battery_voltage == null
            ? null
            : clampValue(
                  Math.round(((location.battery_voltage - 3.3) / 0.9) * 100),
                  0,
                  100
              );
    const signalPercent =
        location?.signal_strength == null
            ? null
            : clampValue(
                  Math.round((location.signal_strength / 31) * 100),
                  0,
                  100
              );
    const speed = location?.speed == null ? null : location.speed;
    const speedPercent =
        speed == null
            ? null
            : clampValue(Math.round((speed / 25) * 100), 0, 100);
    const lastPing = location?.recorded_at ?? device.last_contact_at;
    const statusPercent =
        status.key === 'online'
            ? 100
            : status.key === 'stale'
              ? 50
              : status.key === 'offline'
                ? 5
                : 0;

    return (
        <div className="dd-kpi-row">
            <KpiCard
                icon={<Battery size={15} />}
                label={t.kpi.battery}
                value={
                    location?.battery_voltage == null
                        ? '—'
                        : `${batteryPercent} %`
                }
                hint={batteryPercent == null ? '—' : `${batteryPercent}%`}
                percent={batteryPercent}
                tone={getVehicleBatteryMetricTone(batteryPercent)}
            />
            <KpiCard
                icon={<Signal size={15} />}
                label={t.kpi.signal}
                value={
                    location?.signal_strength == null
                        ? '—'
                        : `${location.signal_strength}/31`
                }
                hint={signalPercent == null ? '—' : `${signalPercent}%`}
                percent={signalPercent}
                tone={getVehicleBatteryMetricTone(signalPercent)}
            />
            <KpiCard
                icon={<Gauge size={15} />}
                label={t.kpi.speed}
                value={
                    speed == null
                        ? '0 m/s'
                        : `${speed.toFixed(1)} ${t.units.speed}`
                }
                hint={
                    speed == null
                        ? '0 m/s'
                        : speed === 0
                          ? t.stationary
                          : t.moving
                }
                percent={speedPercent}
                tone={
                    speed == null
                        ? ''
                        : speed > 20
                          ? 'bad'
                          : speed > 14
                            ? 'warn'
                            : 'ok'
                }
            />
            <KpiCard
                icon={<Clock3 size={15} />}
                label={t.kpi.lastPing}
                value={formatRelativeTime(lastPing, locale, date)}
                hint={formatDateTime(lastPing, locale)}
                percent={statusPercent}
                tone={
                    status.key === 'online'
                        ? 'ok'
                        : status.key === 'stale'
                          ? 'warn'
                          : 'bad'
                }
            />
        </div>
    );
}
