import type { ChangeEvent } from 'react';
import type { JSX } from 'react/jsx-runtime';
//-- Types
import type { Translation } from '@/i18n';
import type { ApiKeySortKey } from '@/types';
//-- Constants
import { API_KEY_SORT_OPTIONS } from '@/constants';
//-- Icons
import { RefreshCw, Search as SearchIcon } from 'lucide-react';
//-- Utils
import { isApiKeySortKey } from '@/lib/api-keys-utils';
//-- Components
import { Button } from '@/components/react/ui/button';
import { Select } from '@/components/react/form/ui';

/**
 * Props for the AccessFilterBar component.
 * @interface AccessFilterBarProps
 * @prop {Translation['apiKeys']['filters']} t - Localized strings.
 * @prop {string} query - Current search query.
 * @prop {(v: string) => void} onQuery - Called on each keystroke.
 * @prop {ApiKeySortKey} sortBy - Current sort key.
 * @prop {(v: ApiKeySortKey) => void} onSortBy - Called when sort changes.
 * @prop {() => void} onRefresh - Called when the refresh button is clicked.
 */
interface AccessFilterBarProps {
    t: Translation['apiKeys']['filters'];
    query: string;
    onQuery: (v: string) => void;
    sortBy: ApiKeySortKey;
    onSortBy: (v: ApiKeySortKey) => void;
    onRefresh: () => void;
}

/**
 * AccessFilterBar — search + sort + refresh for the access keys table.
 * @param {AccessFilterBarProps} props
 * @returns {JSX.Element}
 */
export function AccessFilterBar({
    t,
    query,
    onQuery,
    sortBy,
    onSortBy,
    onRefresh,
}: AccessFilterBarProps): JSX.Element {
    const sortOptions = API_KEY_SORT_OPTIONS.map(k => ({
        value: k,
        label: t.sort[k],
    }));

    return (
        <div className="access-filter-bar">
            <div className="access-search-row">
                <label className="access-search">
                    <SearchIcon
                        size={14}
                        strokeWidth={1.6}
                        aria-hidden="true"
                    />
                    <input
                        type="text"
                        placeholder={t.searchPlaceholder}
                        value={query}
                        onChange={e => onQuery(e.target.value)}
                        aria-label={t.searchPlaceholder}
                    />
                </label>
                <Button
                    variant="ghost"
                    iconOnly
                    aria-label={t.sortLabel}
                    title={t.sortLabel}
                    onClick={onRefresh}
                >
                    <RefreshCw size={14} strokeWidth={1.6} />
                </Button>
            </div>
            <div className="access-filter-row">
                <div className="access-filter-icon">
                    <Select
                        options={sortOptions}
                        value={sortBy}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                            if (isApiKeySortKey(e.target.value)) {
                                onSortBy(e.target.value);
                            }
                        }}
                        aria-label={t.sortLabel}
                    />
                </div>
            </div>
        </div>
    );
}
