import i18n from '@/lib/i18n';

export type FilterSelectKey =
    | 'country'
    | 'marital_status'
    | 'sect'
    | 'education'
    | 'ethnic_group'
    | 'born_muslim'
    | 'following';

export type ExploreFilterState = {
    ageMin: number;
    ageMax: number;
    heightMin: number;
    heightMax: number;
    country: string[];
    marital_status: string[];
    sect: string[];
    education: string[];
    ethnic_group: string[];
    born_muslim: string[];
    following: string[];
    labels?: Partial<Record<FilterSelectKey, Record<string, string>>>;
};

export type SelectOption = { value: string; label: string; key?: string };

export const DEFAULT_EXPLORE_FILTERS: ExploreFilterState = {
    ageMin: 18,
    ageMax: 80,
    heightMin: 120,
    heightMax: 220,
    country: [],
    marital_status: [],
    sect: [],
    education: [],
    ethnic_group: [],
    born_muslim: [],
    following: [],
    labels: {},
};

export const FILTER_PARAM: Record<FilterSelectKey, string> = {
    country: 'country',
    marital_status: 'marital_status',
    sect: 'sect_id',
    education: 'edu_id',
    ethnic_group: 'ethnic_id',
    born_muslim: 'born_muslim',
    following: 'following_id',
};

export const FILTER_LABEL_KEYS_BY_PARAM: Record<string, string> = {
    country: 'country',
    city: 'city',
    geo: 'current_location',
    age: 'age',
    height: 'height',
    marital_status: 'marital_status',
    sect_id: 'sect',
    maslak_id: 'maslak',
    edu_id: 'education',
    ethnic_id: 'ethnic_group',
    following_id: 'following',
    born_muslim: 'born_muslim',
    is_practising: 'how_practising_are_you',
    hobby_id: 'hobbies',
    occ_id: 'occupation',
    desig_id: 'designation',
};

const SELECT_FILTER_KEY_BY_PARAM: Partial<Record<string, FilterSelectKey>> = {
    country: 'country',
    marital_status: 'marital_status',
    sect_id: 'sect',
    edu_id: 'education',
    ethnic_id: 'ethnic_group',
    following_id: 'following',
    born_muslim: 'born_muslim',
};

const RANGE_FILTER_KEY_BY_PARAM: Partial<Record<string, 'age' | 'height'>> = {
    age: 'age',
    age_min: 'age',
    age_max: 'age',
    height: 'height',
    h_min_cm: 'height',
    h_max_cm: 'height',
};

export const SECT_FILTERS: Record<string, { following: string[] }> = {
    sunni: {
        following: ['ahle_hadith', 'ahle_sunnat', 'deobandi', 'barelvi', 'sufi', 'tabligi', 'other_sunni'],
    },
    shia: {
        following: ['ithna_ashari', 'bohra', 'ismaili', 'zaidi', 'just_shia', 'other_shia'],
    },
    ibadi: {
        following: ['ahle_hadith', 'ahle_sunnat', 'other_sunni'],
    },
};

export function buildExploreParams(state: ExploreFilterState): Record<string, string | number> {
    const params: Record<string, string | number> = {};
    if (state.ageMin > 18) params.age_min = state.ageMin;
    if (state.ageMax < 80) params.age_max = state.ageMax;
    if (state.heightMin > 120) params.h_min_cm = state.heightMin;
    if (state.heightMax < 220) params.h_max_cm = state.heightMax;
    (Object.keys(FILTER_PARAM) as FilterSelectKey[]).forEach((key) => {
        const values = state[key];
        if (values.length > 0) params[FILTER_PARAM[key]] = values.join(',');
    });
    return params;
}

export function activeExploreFilterCount(state: ExploreFilterState) {
    let count = 0;
    if (state.ageMin > 18 || state.ageMax < 80) count += 1;
    if (state.heightMin > 120 || state.heightMax < 220) count += 1;
    (Object.keys(FILTER_PARAM) as FilterSelectKey[]).forEach((key) => {
        if (state[key].length > 0) count += 1;
    });
    return count;
}

export function resetExploreFilters(): ExploreFilterState {
    return { ...DEFAULT_EXPLORE_FILTERS, country: [], marital_status: [], sect: [], education: [], ethnic_group: [], born_muslim: [], following: [], labels: {} };
}

export function normalizeMasterKey(value?: string | null) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

export function masterOptions(items: any[] = [], namespace: 'common' | 'ethnic_group' = 'common'): SelectOption[] {
    return items.reduce<SelectOption[]>((acc, item) => {
            const value = String(item?._id || item?.id || item?.value_id || item?.value || '');
            if (!value) return acc;
            const key = normalizeMasterKey(item?.key || item?.label || item?.name || value);
            const fallback = String(item?.label || item?.name || key || value).replace(/_/g, ' ');
            const label = i18n.t(key, { ns: namespace, defaultValue: i18n.t(key, { defaultValue: fallback }) });
            acc.push({ value, label: String(label), key });
            return acc;
        }, []);
}

export function staticOptions(values: string[]): SelectOption[] {
    return values.map((value) => ({
        value,
        key: value,
        label: i18n.t(value, { defaultValue: value.replace(/_/g, ' ') }),
    }));
}

export function countryOptions(): SelectOption[] {
    const enCountries = require('../locales/en/countries.json') as Record<string, string>;
    return Object.keys(enCountries)
        .filter((key) => key.startsWith('c_'))
        .map((key) => {
            const iso = key.slice(2).toUpperCase();
            return {
                value: iso,
                key,
                label: i18n.t(key, { ns: 'countries', defaultValue: enCountries[key] }),
            };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
}

export function cleanFilterOptionLabel(label: string) {
    return String(label || '').replace(/\s+\(\d+\)\s*$/u, '').trim();
}

function droppedFilterLabel(param: string) {
    const labelKey = FILTER_LABEL_KEYS_BY_PARAM[param] || param;
    return String(i18n.t(labelKey, { defaultValue: labelKey.replace(/_/g, ' ') }));
}

function fallbackValueLabel(key: FilterSelectKey, value: string) {
    if (key === 'country') {
        const countryKey = `c_${String(value).toLowerCase()}`;
        return String(i18n.t(countryKey, { ns: 'countries', defaultValue: value }));
    }
    return String(i18n.t(value, { defaultValue: value.replace(/_/g, ' ') }));
}

function selectedValueLabels(state: ExploreFilterState, key: FilterSelectKey) {
    return state[key]
        .map((value) => cleanFilterOptionLabel(state.labels?.[key]?.[value] || fallbackValueLabel(key, value)))
        .filter(Boolean);
}

export type DroppedFilterEntry =
    | string
    | { param?: string; key?: string; values?: string[] };

export function describeDroppedFilters(state: ExploreFilterState, droppedEntries: DroppedFilterEntry[]) {
    const seen = new Set<string>();
    const descriptions: string[] = [];

    droppedEntries.forEach((entry) => {
        if (typeof entry === 'string') {
            const param = entry.split(/[=:]/)[0].trim();
            const rangeKey = RANGE_FILTER_KEY_BY_PARAM[param];
            if (rangeKey && !seen.has(rangeKey)) {
                if (
                    (rangeKey === 'age' && (state.ageMin !== 18 || state.ageMax !== 80)) ||
                    (rangeKey === 'height' && (state.heightMin !== 120 || state.heightMax !== 220))
                ) {
                    descriptions.push(droppedFilterLabel(param));
                    seen.add(rangeKey);
                }
                return;
            }

            const key = SELECT_FILTER_KEY_BY_PARAM[param];
            if (!key || seen.has(key)) return;
            seen.add(key);

            if (state[key].length === 0) return;
            const values = selectedValueLabels(state, key);
            descriptions.push(`${droppedFilterLabel(param)}: ${values.join(', ')}`);
            return;
        }

        const param = String(entry.param || entry.key || '').trim();
        const key = SELECT_FILTER_KEY_BY_PARAM[param];
        const droppedValues = Array.isArray(entry.values) ? entry.values.map(String) : [];
        if (!key || !droppedValues.length) return;

        const valueLabels = droppedValues
            .map((value) => cleanFilterOptionLabel(state.labels?.[key]?.[value] || fallbackValueLabel(key, value)))
            .filter(Boolean);
        for (const label of valueLabels) {
            if (seen.has(label)) continue;
            seen.add(label);
            descriptions.push(label);
        }
    });

    return descriptions;
}

export function clearDroppedFilters(state: ExploreFilterState, droppedEntries: DroppedFilterEntry[]) {
    const next: ExploreFilterState = {
        ...state,
        country: [...state.country],
        marital_status: [...state.marital_status],
        sect: [...state.sect],
        education: [...state.education],
        ethnic_group: [...state.ethnic_group],
        born_muslim: [...state.born_muslim],
        following: [...state.following],
        labels: state.labels ? { ...state.labels } : {},
    };
    const seen = new Set<string>();

    droppedEntries.forEach((entry) => {
        if (typeof entry === 'string') {
            const param = entry.split(/[=:]/)[0].trim();
            const rangeKey = RANGE_FILTER_KEY_BY_PARAM[param];
            if (rangeKey && !seen.has(rangeKey)) {
                seen.add(rangeKey);
                if (rangeKey === 'age') {
                    next.ageMin = 18;
                    next.ageMax = 80;
                } else {
                    next.heightMin = 120;
                    next.heightMax = 220;
                }
                return;
            }

            const key = SELECT_FILTER_KEY_BY_PARAM[param];
            if (!key || seen.has(key)) return;
            seen.add(key);

            next[key] = [];
            if (next.labels?.[key]) next.labels[key] = {};
            return;
        }

        const param = String(entry.param || entry.key || '').trim();
        const key = SELECT_FILTER_KEY_BY_PARAM[param];
        const droppedValues = Array.isArray(entry.values) ? entry.values.map(String) : [];
        if (!key || !droppedValues.length) return;

        const dropSet = new Set(droppedValues);
        next[key] = next[key].filter((value) => !dropSet.has(String(value)));
        for (const value of droppedValues) {
            if (next.labels?.[key]) delete next.labels[key][value];
        }
    });

    return next;
}

export function labelDroppedFilters(keys: string[]) {
    return keys
        .map((key) => FILTER_LABEL_KEYS_BY_PARAM[key] || key)
        .map((key) => i18n.t(key, { defaultValue: key.replace(/_/g, ' ') }))
        .filter(Boolean)
        .map(String);
}
