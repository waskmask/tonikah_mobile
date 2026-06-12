import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ChevronLeft, X } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { MultiSelectSheet, MultiSelectOption } from '@/components/ui/MultiSelectSheet';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { useTheme } from '@/hooks/useTheme';
import { profileService } from '@/lib/profileService';
import { t } from '@/lib/profileDisplay';
import {
    ExploreFilterState,
    FilterSelectKey,
    activeExploreFilterCount,
    buildExploreParams,
    countryOptions,
    masterOptions,
    normalizeMasterKey,
    resetExploreFilters,
    staticOptions,
    SECT_FILTERS,
} from '@/lib/exploreFilters';

type Props = {
    visible: boolean;
    state: ExploreFilterState;
    onClose: () => void;
    onApply: (next: ExploreFilterState, params: Record<string, string | number>) => void;
};

type MasterState = {
    sect: any[];
    education: any[];
    ethnic_group: any[];
    following: any[];
};

const LABELS: Record<FilterSelectKey, string> = {
    country: 'country',
    marital_status: 'marital_status',
    sect: 'sect',
    education: 'education',
    ethnic_group: 'ethnic_group',
    born_muslim: 'born_muslim',
    following: 'following',
};

export function ExploreFilterDrawer({ visible, state, onClose, onApply }: Props) {
    const { isDark } = useTheme();
    const { isRTL } = useLanguage();
    const [draft, setDraft] = useState<ExploreFilterState>(state);
    const [activeSelect, setActiveSelect] = useState<FilterSelectKey | null>(null);
    const [master, setMaster] = useState<MasterState>({ sect: [], education: [], ethnic_group: [], following: [] });

    useEffect(() => {
        if (visible) setDraft(state);
    }, [state, visible]);

    useEffect(() => {
        if (!visible) return;
        let mounted = true;
        Promise.all([
            profileService.fetchMasterdata('sect'),
            profileService.fetchMasterdata('education'),
            profileService.fetchMasterdata('ethnic_group'),
            profileService.fetchMasterdata('following'),
        ]).then(([sect, education, ethnic, following]) => {
            if (!mounted) return;
            setMaster({
                sect: sect.data || [],
                education: education.data || [],
                ethnic_group: ethnic.data || [],
                following: following.data || [],
            });
        }).catch(() => undefined);
        return () => {
            mounted = false;
        };
    }, [visible]);

    const options = useMemo<Record<FilterSelectKey, MultiSelectOption[]>>(() => {
        const sect = masterOptions(master.sect);
        const selectedSectKeys = draft.sect
            .map((id) => sect.find((item) => item.value === id)?.key)
            .filter(Boolean)
            .map((key) => normalizeMasterKey(key));
        const allowedFollowing = new Set<string>();
        selectedSectKeys.forEach((key) => {
            const config = SECT_FILTERS[key];
            if (config) config.following.forEach((item) => allowedFollowing.add(item));
        });
        let following = masterOptions(master.following);
        if (allowedFollowing.size > 0) {
            following = following.filter((item) => !item.key || allowedFollowing.has(normalizeMasterKey(item.key)));
        }
        return {
            country: countryOptions(),
            marital_status: staticOptions(['never_married', 'divorced', 'separated', 'widowed', 'annulled']),
            sect,
            education: masterOptions(master.education),
            ethnic_group: masterOptions(master.ethnic_group, 'ethnic_group'),
            born_muslim: staticOptions(['muslim_by_birth', 'convert_revert']),
            following,
        };
    }, [draft.sect, master]);

    const apply = () => {
        onApply(draft, buildExploreParams(draft));
        onClose();
    };

    const clearAll = () => {
        setDraft(resetExploreFilters());
    };

    const updateSelect = (key: FilterSelectKey, values: string[]) => {
        setDraft((current) => {
            const next = { ...current, [key]: values };
            if (key === 'sect') {
                const allowed = options.following.map((item) => item.value);
                next.following = next.following.filter((item) => allowed.includes(item));
            }
            return next;
        });
    };

    const activeCount = activeExploreFilterCount(draft);
    const activeOptions = activeSelect ? options[activeSelect] : [];

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
            <View style={[styles.root, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
                <View style={[styles.header, { backgroundColor: isDark ? '#111827' : '#FFFFFF', borderBottomColor: isDark ? '#334155' : '#E2E8F0' }]}>
                    <Pressable onPress={clearAll} disabled={activeCount === 0} style={styles.clearButton}>
                        <Text variant="body-sm" className="font-body-semi" style={{ color: activeCount ? '#F34B6F' : isDark ? '#475569' : '#CBD5E1' }}>
                            {t('clear_all', 'Clear all')}
                        </Text>
                    </Pressable>
                    <Text variant="body" className="font-body-semi" style={styles.title}>{t('filters', 'Filters')}</Text>
                    <Pressable onPress={onClose} style={styles.closeButton}>
                        <X size={scale(20)} color={isDark ? '#E2E8F0' : '#1F2A24'} />
                    </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <RangeRow
                        label={t('age', 'Age')}
                        min={18}
                        max={80}
                        step={1}
                        valueMin={draft.ageMin}
                        valueMax={draft.ageMax}
                        onChange={(ageMin, ageMax) => setDraft((current) => ({ ...current, ageMin, ageMax }))}
                        isDark={isDark}
                    />
                    <RangeRow
                        label={t('height', 'Height')}
                        min={120}
                        max={220}
                        step={5}
                        unit="cm"
                        valueMin={draft.heightMin}
                        valueMax={draft.heightMax}
                        onChange={(heightMin, heightMax) => setDraft((current) => ({ ...current, heightMin, heightMax }))}
                        isDark={isDark}
                    />
                    {(Object.keys(LABELS) as FilterSelectKey[]).map((key) => (
                        <SelectRow
                            key={key}
                            label={t(LABELS[key], LABELS[key].replace(/_/g, ' '))}
                            values={draft[key]}
                            options={options[key]}
                            isDark={isDark}
                            isRTL={isRTL}
                            onOpen={() => setActiveSelect(key)}
                            onClear={() => updateSelect(key, [])}
                        />
                    ))}
                </ScrollView>

                <View style={[styles.footer, { backgroundColor: isDark ? '#111827' : '#FFFFFF', borderTopColor: isDark ? '#334155' : '#E2E8F0' }]}>
                    <GradientButton title={t('show_results', 'Show results')} onPress={apply} widthMode="full" />
                </View>

                {activeSelect ? (
                    <MultiSelectSheet
                        visible={Boolean(activeSelect)}
                        onClose={() => setActiveSelect(null)}
                        onConfirm={(values) => updateSelect(activeSelect, values)}
                        options={activeOptions}
                        selected={draft[activeSelect]}
                        title={t(LABELS[activeSelect], LABELS[activeSelect].replace(/_/g, ' '))}
                        searchEnabled={['country', 'education', 'ethnic_group'].includes(activeSelect)}
                        searchPlaceholder={t('search', 'Search...')}
                        presentation="drawer"
                    />
                ) : null}
            </View>
        </Modal>
    );
}

function RangeRow({
    label,
    min,
    max,
    step,
    unit,
    valueMin,
    valueMax,
    onChange,
    isDark,
}: {
    label: string;
    min: number;
    max: number;
    step: number;
    unit?: string;
    valueMin: number;
    valueMax: number;
    onChange: (min: number, max: number) => void;
    isDark: boolean;
}) {
    const value = `${valueMin} - ${valueMax}${unit ? ` ${unit}` : ''}`;
    return (
        <View style={[styles.row, { backgroundColor: isDark ? '#111827' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
            <View style={{ flex: 1 }}>
                <Text variant="body" className="font-body-semi">{label}</Text>
                <Text variant="body-sm" style={{ color: '#F34B6F', marginTop: scale(3) }}>{value}</Text>
            </View>
            <Stepper label="-" onPress={() => onChange(Math.max(min, valueMin - step), valueMax)} isDark={isDark} />
            <Stepper label="+" onPress={() => onChange(Math.min(valueMax - step, valueMin + step), valueMax)} isDark={isDark} />
            <Stepper label="-" onPress={() => onChange(valueMin, Math.max(valueMin + step, valueMax - step))} isDark={isDark} />
            <Stepper label="+" onPress={() => onChange(valueMin, Math.min(max, valueMax + step))} isDark={isDark} />
        </View>
    );
}

function Stepper({ label, onPress, isDark }: { label: string; onPress: () => void; isDark: boolean }) {
    return (
        <Pressable onPress={onPress} style={[styles.stepper, { borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
            <Text variant="body" className="font-body-semi">{label}</Text>
        </Pressable>
    );
}

function SelectRow({
    label,
    values,
    options,
    isDark,
    isRTL,
    onOpen,
    onClear,
}: {
    label: string;
    values: string[];
    options: MultiSelectOption[];
    isDark: boolean;
    isRTL: boolean;
    onOpen: () => void;
    onClear: () => void;
}) {
    const text = values.length
        ? values.map((value) => options.find((item) => item.value === value)?.label || value).join(', ')
        : t('no_preference', 'No preference');
    return (
        <Pressable onPress={onOpen} style={[styles.row, { backgroundColor: isDark ? '#111827' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0', flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={{ flex: 1 }}>
                <Text variant="body" className="font-body-semi" style={{ textAlign: isRTL ? 'right' : 'left' }}>{label}</Text>
                <Text variant="body-sm" numberOfLines={1} style={{ color: values.length ? '#F34B6F' : isDark ? '#94A3B8' : '#64748B', marginTop: scale(3), textAlign: isRTL ? 'right' : 'left' }}>{text}</Text>
            </View>
            {values.length > 0 ? (
                <Pressable onPress={onClear} style={styles.rowIcon}>
                    <X size={scale(16)} color="#F34B6F" />
                </Pressable>
            ) : (
                <View style={styles.rowIcon}>
                    <ChevronLeft size={scale(18)} color={isDark ? '#94A3B8' : '#64748B'} style={{ transform: [{ rotate: isRTL ? '0deg' : '180deg' }] }} />
                </View>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: {
        paddingTop: scale(40),
        minHeight: scale(88),
        borderBottomWidth: 1,
        paddingHorizontal: scale(14),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    clearButton: { minWidth: scale(78), paddingVertical: scale(8) },
    title: { fontSize: scale(17) },
    closeButton: { width: scale(40), height: scale(40), alignItems: 'center', justifyContent: 'center' },
    content: { padding: scale(14), gap: scale(10), paddingBottom: scale(24) },
    row: {
        borderWidth: 1,
        borderRadius: scale(8),
        minHeight: scale(64),
        paddingHorizontal: scale(14),
        paddingVertical: scale(12),
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(8),
    },
    stepper: {
        width: scale(34),
        height: scale(34),
        borderRadius: scale(17),
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowIcon: {
        width: scale(32),
        height: scale(32),
        alignItems: 'center',
        justifyContent: 'center',
    },
    footer: {
        borderTopWidth: 1,
        paddingHorizontal: scale(14),
        paddingTop: scale(12),
        paddingBottom: scale(20),
    },
});
