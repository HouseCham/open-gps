//-- Types
import type {
    DeviceSortKey,
    DeviceStatusFilter,
    DeviceVehicleFilter,
} from '@/constants';
import type { Translation } from '@/i18n';
import type { ChangeEvent } from 'react';
import type { JSX } from 'react/jsx-runtime';
//-- Icons
import {
    Filter as FilterIcon,
    RefreshCw,
    Search as SearchIcon,
} from 'lucide-react';
//-- Components
import { Button } from '@/components/react/ui/button';
import { Select } from '@/components/react/form/ui';
/**
 * Properties for the DeviceFilterBar component.
 * @interface DeviceFilterBarProps
 * @prop {Translation['device']} t - Translation strings.
 * @prop {string} query - The search query.
 * @prop {(v: string) => void} onQuery - Called on each keystroke.
 * @prop {DeviceStatusFilter} statusFilter - The current status filter.
 * @prop {(v: DeviceStatusFilter) => void} onStatusFilter - Called when the status filter changes.
 * @prop {Record<string, string>} statusOptions - The options for the status filter.
 * @prop {DeviceVehicleFilter} vehicleFilter - The current vehicle filter.
 * @prop {(v: DeviceVehicleFilter) => void} onVehicleFilter - Called when the vehicle filter changes.
 * @prop {{ value: DeviceVehicleFilter; label: string }[]} vehicleOptions - The options for the vehicle filter.
 * @prop {DeviceSortKey} sortBy - The current sort key.
 * @prop {(v: DeviceSortKey) => void} onSortBy - Called when the sort key changes.
 * @prop {{ value: DeviceSortKey; label: string }[]} sortOptions - The options for the sort key.
 * @prop {() => void} onRefresh - Called when the refresh button is clicked.
 */
interface DeviceFilterBarProps {
    t: Translation['device'];
    query: string;
    onQuery: (v: string) => void;
    statusFilter: DeviceStatusFilter;
    onStatusFilter: (v: DeviceStatusFilter) => void;
    statusOptions: Record<string, string>;
    vehicleFilter: DeviceVehicleFilter;
    onVehicleFilter: (v: DeviceVehicleFilter) => void;
    vehicleOptions: { value: DeviceVehicleFilter; label: string }[];
    sortBy: DeviceSortKey;
    onSortBy: (v: DeviceSortKey) => void;
    sortOptions: { value: DeviceSortKey; label: string }[];
    onRefresh: () => void;
}
/**
 * The DeviceFilterBar component.
 * @param {DeviceFilterBarProps} props - The props for the component.
 * @returns {JSX.Element} The rendered component.
 */
export function DeviceFilterBar({
    t,
    query,
    onQuery,
    statusFilter,
    onStatusFilter,
    statusOptions,
    vehicleFilter,
    onVehicleFilter,
    vehicleOptions,
    sortBy,
    onSortBy,
    sortOptions,
    onRefresh,
}: DeviceFilterBarProps): JSX.Element {
    return (
        <div className="dev-filter-bar">
            {/* Search */}
            <div className="dev-search-row">
                <label className="dev-search">
                    <SearchIcon
                        size={14}
                        strokeWidth={1.6}
                        aria-hidden="true"
                    />
                    <input
                        type="text"
                        placeholder={t.table.searchPlaceholder}
                        value={query}
                        onChange={e => onQuery(e.target.value)}
                        aria-label={t.table.searchPlaceholder}
                    />
                </label>
                <Button
                    variant="ghost"
                    iconOnly
                    aria-label={t.table.refresh}
                    title={t.table.refresh}
                    onClick={onRefresh}
                >
                    <RefreshCw size={14} strokeWidth={1.6} />
                </Button>
            </div>
            {/* Filters */}
            <div className="dev-filter-row">
                <FilterIconLabel
                    icon={<FilterIcon size={13} strokeWidth={1.6} />}
                >
                    <Select
                        options={[
                            { value: 'all', label: statusOptions['all'] },
                            { value: 'online', label: statusOptions['online'] },
                            { value: 'stale', label: statusOptions['stale'] },
                            {
                                value: 'offline',
                                label: statusOptions['offline'],
                            },
                            {
                                value: 'never-seen',
                                label: statusOptions['never-seen'],
                            },
                        ]}
                        value={statusFilter}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                            onStatusFilter(e.target.value as DeviceStatusFilter)
                        }
                        aria-label={t.table.status}
                    />
                </FilterIconLabel>
                <Select
                    options={vehicleOptions}
                    value={vehicleFilter}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                        onVehicleFilter(e.target.value as DeviceVehicleFilter)
                    }
                    aria-label={t.table.vehicleType}
                />
                <Select
                    options={sortOptions}
                    value={sortBy}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                        onSortBy(e.target.value as DeviceSortKey)
                    }
                    aria-label={t.table.actions}
                />
            </div>
        </div>
    );
}
/**
 * The FilterIconLabel component.
 * @param {FilterIconLabelProps} props - The props for the component.
 * @returns {JSX.Element} The rendered component.
 */
function FilterIconLabel({
    icon,
    children,
}: {
    icon: JSX.Element;
    children: React.ReactNode;
}): JSX.Element {
    return (
        <div className="dev-filter-icon">
            {icon}
            {children}
        </div>
    );
}
