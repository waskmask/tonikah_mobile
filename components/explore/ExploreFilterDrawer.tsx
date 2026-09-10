import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, X } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { MultiSelectSheet, MultiSelectOption } from '@/components/ui/MultiSelectSheet';
import { RangeRow } from '@/components/ui/RangeRow';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { useTheme } from '@/hooks/useTheme';
import { useColors } from '@/hooks/useColors';
import { useToast } from '@/hooks/useToast';
import { profileService } from '@/lib/profileService';
import { t } from '@/lib/profileDisplay';
import {
    ExploreFilterState,
    FilterSelectKey,
    activeExploreFilterCount,
    buildExploreParams,
    cleanFilterOptionLabel,
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

type DrawerOption = MultiSelectOption & { key?: string };

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
    const colors = useColors();
    const { isRTL } = useLanguage();
    const toast = useToast();
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
        }).catch(() => {
            if (!mounted) return;
            toast.show(t('filter_data_unavailable', 'Some filter data is unavailable. Please try again.'), 'warning');
        });
        return () => {
            mounted = false;
        };
    }, [state, toast, visible]);

    const options = useMemo<Record<FilterSelectKey, DrawerOption[]>>(() => {
        const country = countryOptions();
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
            country,
            marital_status: staticOptions(['never_married', 'divorced', 'separated', 'widowed', 'annulled']),
            sect,
            education: masterOptions(master.education),
            ethnic_group: masterOptions(master.ethnic_group, 'ethnic_group'),
            born_muslim: staticOptions(['muslim_by_birth', 'convert_revert']),
            following,
        };
    }, [draft.sect, master]);

    const apply = () => {
        const labels = (Object.keys(LABELS) as FilterSelectKey[]).reduce<NonNullable<ExploreFilterState['labels']>>((acc, key) => {
            acc[key] = options[key].reduce<Record<string, string>>((map, option) => {
                map[option.value] = cleanFilterOptionLabel(option.label);
                return map;
            }, {});
            return acc;
        }, {});
        const next = { ...draft, labels };
        onApply(next, buildExploreParams(next));
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

    const openSelect = (key: FilterSelectKey) => {
        if (options[key].length === 0) {
            toast.show(t('filter_data_unavailable', 'No data is available for this filter right now.'), 'warning');
            return;
        }
        setActiveSelect(key);
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            statusBarTranslucent
            navigationBarTranslucent
            onRequestClose={onClose}
        >
            <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: colors.chrome.header.background }]}>
                <View style={[styles.header, { backgroundColor: colors.chrome.header.background, borderBottomColor: colors.brand.bg.border }]}>
                    <Pressable onPress={clearAll} disabled={activeCount === 0} style={styles.clearButton}>
                        <Text variant="body-sm" className="font-body-semi" numberOfLines={1} style={{ color: activeCount ? colors.chrome.primary : colors.brand.text.muted }}>
                            {t('clear_all', 'Clear all')}
                        </Text>
                    </Pressable>
                    <View pointerEvents="none" style={styles.titleWrap}>
                        <Text variant="body-sm" className="font-body-bold" numberOfLines={1} style={styles.title}>{t('filters', 'Filters')}</Text>
                    </View>
                    <Pressable onPress={onClose} style={styles.closeButton}>
                        <X size={22} color={colors.chrome.header.icon} />
                    </Pressable>
                </View>

                <ScrollView
                    style={{ backgroundColor: colors.brand.bg.surface }}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    <RangeRow
                        label={t('age', 'Age')}
                        min={18}
                        max={80}
                        step={1}
                        valueMin={draft.ageMin}
                        valueMax={draft.ageMax}
                        defaultMin={18}
                        defaultMax={80}
                        onChange={(ageMin, ageMax) => setDraft((current) => ({ ...current, ageMin, ageMax }))}
                        isDark={isDark}
                        primaryColor={colors.chrome.primary}
                        borderColor={colors.brand.bg.border}
                        cardColor={colors.chrome.common.card}
                        mutedColor={colors.chrome.common.textMuted}
                        presentation="band"
                        isRTL={isRTL}
                    />
                    <RangeRow
                        label={t('height', 'Height')}
                        min={120}
                        max={220}
                        step={5}
                        unit="cm"
                        valueMin={draft.heightMin}
                        valueMax={draft.heightMax}
                        defaultMin={120}
                        defaultMax={220}
                        formatValue={formatHeight}
                        onChange={(heightMin, heightMax) => setDraft((current) => ({ ...current, heightMin, heightMax }))}
                        isDark={isDark}
                        primaryColor={colors.chrome.primary}
                        borderColor={colors.brand.bg.border}
                        cardColor={colors.chrome.common.card}
                        mutedColor={colors.chrome.common.textMuted}
                        presentation="band"
                        isRTL={isRTL}
                    />
                    {(Object.keys(LABELS) as FilterSelectKey[]).map((key) => (
                        <SelectRow
                            key={key}
                            label={t(LABELS[key], LABELS[key].replace(/_/g, ' '))}
                            values={draft[key]}
                            options={options[key]}
                            isRTL={isRTL}
                            primaryColor={colors.chrome.primary}
                            borderColor={colors.brand.bg.border}
                            mutedColor={colors.chrome.common.textSubtle}
                            onOpen={() => openSelect(key)}
                            onClear={() => updateSelect(key, [])}
                        />
                    ))}
                </ScrollView>

                <View style={[styles.footer, { backgroundColor: colors.chrome.header.background, borderTopColor: colors.brand.bg.border }]}>
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
            </SafeAreaView>
        </Modal>
    );
}

function formatHeight(cm: number) {
    const totalInches = Math.round(cm / 2.54);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet}'${inches}" (${cm} cm)`;
}

function SelectRow({
    label,
    values,
    options,
    isRTL,
    primaryColor,
    borderColor,
    mutedColor,
    onOpen,
    onClear,
}: {
    label: string;
    values: string[];
    options: DrawerOption[];
    isRTL: boolean;
    primaryColor: string;
    borderColor: string;
    mutedColor: string;
    onOpen: () => void;
    onClear: () => void;
}) {
    const text = values.length
        ? values.map((value) => options.find((item) => item.value === value)?.label || value).join(', ')
        : t('no_preference', 'No preference');
    return (
        <Pressable
            onPress={onOpen}
            accessibilityRole="button"
            accessibilityLabel={`${label}, ${text}`}
            style={[styles.row, { borderColor }]}
        >
            <View style={styles.rowText}>
                <Text variant="body-sm" className="font-body-bold" style={[styles.selectTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
                <Text variant="body-sm" numberOfLines={1} style={{ color: values.length ? primaryColor : mutedColor, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>{text}</Text>
            </View>
            {values.length > 0 ? (
                <Pressable
                    onPress={(event) => {
                        event.stopPropagation();
                        onClear();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('clear', 'Clear')} ${label}`}
                    hitSlop={6}
                    style={styles.rowIcon}
                >
                    <X size={16} color={primaryColor} />
                </Pressable>
            ) : (
                <View style={styles.rowIcon}>
                    <ChevronLeft size={18} color={mutedColor} style={{ transform: [{ rotate: isRTL ? '0deg' : '180deg' }] }} />
                </View>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: {
        height: 50,
        borderBottomWidth: 1,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
    },
    clearButton: { width: 96, paddingVertical: 8, zIndex: 1 },
    titleWrap: {
        position: 'absolute',
        left: 112,
        right: 112,
        top: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: { fontSize: 14, lineHeight: 18, textAlign: 'center' },
    closeButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    content: { paddingBottom: 18 },
    row: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        minHeight: 72,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    rowText: {
        flex: 1,
        minWidth: 0,
    },
    rowIcon: {
        width: 44,
        height: 44,
        marginTop: -6,
        marginHorizontal: -6,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectTitle: {
        fontSize: 14,
        lineHeight: 20,
    },
    footer: {
        borderTopWidth: 1,
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 10,
    },
});
