import { Info, RefreshCw } from 'lucide-react';
import type { JSX } from 'react';

import { Button } from '@/components/react/ui/button';
import {
    REPORT_PERIODS,
    REPORT_TIME_ZONE,
    REPORT_VEHICLE_TYPES,
} from '@/constants/reports';
import { isReportPeriod, isReportVehicleType } from '@/lib/reports-utils';
import type { ReportsFiltersProps } from '@/types/reports';

/** Renders the date, device, and vehicle filters for reports. */
export function ReportsFilters({
    devices,
    deviceIds,
    from,
    period,
    to,
    validationError,
    vehicleType,
    translations: t,
    onApplyPeriod,
    onDeviceToggle,
    onFromChange,
    onRefresh,
    onToChange,
    onVehicleTypeChange,
}: ReportsFiltersProps): JSX.Element {
    function applyPeriod(value: string): void {
        if (!isReportPeriod(value)) return;
        onApplyPeriod(value);
    }

    return (
        <section className="reports-card reports-filters">
            <div className="reports-filters__grid">
                <label className="reports-field">
                    {t.filters.period}
                    <select
                        value={period}
                        onChange={event => applyPeriod(event.target.value)}
                    >
                        {REPORT_PERIODS.map(value => (
                            <option key={value} value={value}>
                                {t.filters[value]}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="reports-field">
                    {t.filters.timezone}
                    <input value={REPORT_TIME_ZONE} readOnly />
                    <small>{t.filters.timezoneHint}</small>
                </label>
                <label className="reports-field">
                    {t.filters.from}
                    <input
                        type="datetime-local"
                        value={from}
                        onChange={event => onFromChange(event.target.value)}
                    />
                </label>
                <label className="reports-field">
                    {t.filters.to}
                    <input
                        type="datetime-local"
                        value={to}
                        onChange={event => onToChange(event.target.value)}
                    />
                </label>
                <label className="reports-field">
                    {t.filters.vehicleType}
                    <select
                        value={vehicleType}
                        onChange={event =>
                            onVehicleTypeChange(
                                isReportVehicleType(event.target.value)
                                    ? event.target.value
                                    : ''
                            )
                        }
                    >
                        <option value="">{t.filters.allVehicleTypes}</option>
                        {REPORT_VEHICLE_TYPES.map(value => (
                            <option key={value} value={value}>
                                {t.vehicles[value]}
                            </option>
                        ))}
                    </select>
                </label>
                <fieldset className="reports-field reports-fieldset">
                    <legend>{t.filters.devices}</legend>
                    <div className="reports-device-options">
                        {devices.map(device => (
                            <label key={device.id}>
                                <input
                                    type="checkbox"
                                    checked={deviceIds.includes(device.id)}
                                    onChange={() => onDeviceToggle(device.id)}
                                />
                                {device.name}
                            </label>
                        ))}
                    </div>
                </fieldset>
                <Button variant="primary" onClick={onRefresh}>
                    <RefreshCw size={14} />
                    {t.refresh}
                </Button>
            </div>
            {validationError && (
                <div className="reports-validation" role="alert">
                    {validationError}
                </div>
            )}
            <footer className="reports-filters__footer">
                <span>
                    <Info size={14} />
                    {t.filters.retentionNote}
                </span>
                <span>
                    {deviceIds.length || devices.length} {t.authorizedDevices}
                </span>
            </footer>
        </section>
    );
}
