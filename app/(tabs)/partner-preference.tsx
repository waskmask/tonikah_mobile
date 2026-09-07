import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { TextModerationWarningModal } from '@/components/app/TextModerationWarningModal';
import { UnderReviewPill } from '@/components/app/UnderReviewPill';
import { GradientButton } from '@/components/ui/GradientButton';
import { MultiSelectSheet } from '@/components/ui/MultiSelectSheet';
import { RangeRow } from '@/components/ui/RangeRow';
import { useTheme } from '@/hooks/useTheme';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { Typography } from '@/constants/typography';
import { LANGUAGE_OPTIONS } from '@/constants/profileOptions';
import { apiMessage, t } from '@/lib/profileDisplay';
import { formatProfileOptionLabel } from '@/lib/profileOptionLabels';
import { masterOptions, staticOptions } from '@/lib/exploreFilters';
import {
    buildPartnerPrefPayload,
    countCharacters,
    defaultPartnerPrefState,
    formatHeightLabel,
    hydratePartnerPrefState,
    PP_ABOUT_MAX,
    PP_AGE_MAX,
    PP_AGE_MIN,
    PP_HEIGHT_MAX_CM,
    PP_HEIGHT_MIN_CM,
    PP_MARITAL_OPTIONS,
    PP_MAX_SELECTIONS,
    PartnerPrefState,
    serializePartnerPrefState,
    trimToCharacterLimit,
} from '@/lib/partnerPreference';
import { profileService } from '@/lib/profileService';
import { useAuthStore } from '@/store/authStore';
import { useEmailVerificationGuard } from '@/hooks/useEmailVerificationGuard';
import { useToast } from '@/hooks/useToast';
import { getTextDirection, localeTextDirection } from '@/lib/textDirection';
import {
    getTextModerationWarning,
    moderationCandidateForEditing,
    pendingModerationCandidate,
    TextModerationWarning,
} from '@/lib/textModeration';

type SheetKey = 'marital' | 'languages' | 'ethnic' | null;

export default function PartnerPreferenceScreen() {
    const { isDark } = useTheme();
    const colors = useColors();
    const primary = colors.chrome.primary;
    const { currentLanguage } = useLanguage();
    const { user, refreshUser } = useAuthStore();
    const { requireVerified } = useEmailVerificationGuard();
    const toast = useToast();

    const [state, setState] = useState<PartnerPrefState>(defaultPartnerPrefState());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeSheet, setActiveSheet] = useState<SheetKey>(null);
    const [ethnicMaster, setEthnicMaster] = useState<any[]>([]);
    const [moderationWarning, setModerationWarning] = useState<TextModerationWarning | null>(null);
    const aboutInputRef = useRef<TextInput>(null);
    const initialLoadRef = useRef(true);
    const baselineRef = useRef<string | null>(null);

    const myGender = String(user?.profile?.gender || '').toLowerCase();
    const aboutModerationMeta = user?.profile?.contentModeration?.partnerPreferenceAboutPartner;
    const aboutPendingReview = Boolean(pendingModerationCandidate(aboutModerationMeta));
    const aboutDirection = getTextDirection(state.about, localeTextDirection(currentLanguage));

    useEffect(() => {
        let mounted = true;
        profileService
            .fetchMasterdata('ethnic_group')
            .then((response) => {
                if (!mounted) return;
                const raw = Array.isArray(response.data) ? response.data : [];
                setEthnicMaster(raw.filter((item: any) => item?.isActive !== false));
            })
            .catch(() => undefined);
        return () => {
            mounted = false;
        };
    }, []);

    const loadPreference = useCallback(async () => {
        if (initialLoadRef.current) setLoading(true);
        await refreshUser().catch(() => undefined);
        const res = await profileService.fetchPartnerPreference();
        const latestProfile = useAuthStore.getState().user?.profile;
        // The owner keeps editing their pending/rejected candidate, not the
        // old approved text other users still see.
        const candidate = moderationCandidateForEditing(
            latestProfile?.contentModeration?.partnerPreferenceAboutPartner,
        );
        const hydrated = hydratePartnerPrefState(
            res.partner_preference,
            String(latestProfile?.gender || ''),
            candidate,
        );
        setState(hydrated);
        baselineRef.current = serializePartnerPrefState(hydrated);
        setLoading(false);
        initialLoadRef.current = false;
    }, [refreshUser]);

    useFocusEffect(
        useCallback(() => {
            void loadPreference();
        }, [loadPreference]),
    );

    const dirty = baselineRef.current !== null && serializePartnerPrefState(state) !== baselineRef.current;

    // Male users cannot prefer "married" women; female users can (co-wife)
    const maritalOptions = useMemo(
        () => staticOptions(PP_MARITAL_OPTIONS.filter((value) => value !== 'married' || myGender === 'female')),
        [myGender, currentLanguage],
    );
    const languageOptions = useMemo(
        () =>
            LANGUAGE_OPTIONS.map((value) => ({
                value,
                label: formatProfileOptionLabel(t(`languages:${value}`, value.replace(/_/g, ' ')), currentLanguage),
            })).sort((a, b) => a.label.localeCompare(b.label)),
        [currentLanguage],
    );
    const ethnicOptions = useMemo(() => masterOptions(ethnicMaster, 'ethnic_group'), [ethnicMaster, currentLanguage]);

    const summaryFor = (values: string[], options: Array<{ value: string; label: string }>) => {
        if (!values.length) return t('no_preference', 'Prefer not to say');
        const labels = values
            .map((value) => options.find((option) => option.value === value)?.label || value)
            .filter(Boolean);
        return labels.join(', ');
    };

    const save = async (submitAnyway = false) => {
        if (saving) return;
        if (!requireVerified('save')) return;
        setSaving(true);
        try {
            const payload = buildPartnerPrefPayload(state);
            const res = await profileService.savePartnerPreference({
                ...payload,
                clientLocale: currentLanguage,
                ...(submitAnyway ? { submitAnyway: true } : {}),
            });
            if (res.success) {
                setModerationWarning(null);
                const nextState = { ...state, about: payload.about_partner };
                setState(nextState);
                // Rebase immediately so Save disables without waiting on refetch
                baselineRef.current = serializePartnerPrefState(nextState);
                await refreshUser();
                const savedForReview = Boolean(
                    pendingModerationCandidate(
                        useAuthStore.getState().user?.profile?.contentModeration
                            ?.partnerPreferenceAboutPartner,
                    ),
                );
                toast.show(
                    submitAnyway || savedForReview
                        ? t('moderation_submit_anyway_success', 'Submitted for review.')
                        : t('partner_preference_updated', 'Partner preference updated successfully.'),
                    'success',
                    3000,
                );
            } else {
                const warning = getTextModerationWarning(res);
                if (warning) {
                    setModerationWarning(warning);
                } else {
                    Alert.alert(t('error', 'Error'), apiMessage(res.message));
                }
            }
        } catch {
            toast.show(t('something_went_wrong', 'Something went wrong.'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const clearAll = () => {
        setState(defaultPartnerPrefState());
    };

    const remaining = PP_ABOUT_MAX - countCharacters(state.about);

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.brand.bg.surface }]}>
                <ActivityIndicator color={primary} />
            </View>
        );
    }

    const sheetConfig =
        activeSheet === 'marital'
            ? {
                title: t('preferred_marital_status', 'Preferred marital status'),
                options: maritalOptions,
                selected: state.marital,
                max: undefined as number | undefined,
                searchEnabled: false,
                apply: (values: string[]) => setState((current) => ({ ...current, marital: values })),
            }
            : activeSheet === 'languages'
                ? {
                    title: t('preferred_languages', 'Preferred languages'),
                    options: languageOptions,
                    selected: state.languages,
                    max: PP_MAX_SELECTIONS,
                    searchEnabled: true,
                    apply: (values: string[]) => setState((current) => ({ ...current, languages: values })),
                }
                : activeSheet === 'ethnic'
                    ? {
                        title: t('preferred_ethnicity', 'Preferred ethnicity'),
                        options: ethnicOptions,
                        selected: state.ethnic,
                        max: PP_MAX_SELECTIONS,
                        searchEnabled: true,
                        apply: (values: string[]) => setState((current) => ({ ...current, ethnic: values })),
                    }
                    : null;

    return (
        <View style={{ flex: 1, backgroundColor: colors.brand.bg.surface }}>
            <AppBackTitleBar title={t('partner_preference', 'Partner Preference')} />
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(14), paddingBottom: scale(24), gap: scale(12) }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={[styles.introCard, { backgroundColor: colors.chrome.common.card, borderColor: colors.brand.bg.border }]}>
                    <Text variant="body-sm" className="font-body-bold">
                        {t('pp_ideal_title', 'Describe your ideal partner')}
                    </Text>
                    <Text variant="caption" style={{ color: colors.brand.text.subtitle, marginTop: scale(3) }}>
                        {t('pp_ideal_desc', 'These preferences help us show you more relevant profiles.')}
                    </Text>
                </View>

                <RangeRow
                    label={t('preferred_age', 'Preferred age')}
                    min={PP_AGE_MIN}
                    max={PP_AGE_MAX}
                    step={1}
                    unit={t('years', 'years')}
                    valueMin={state.ageFrom}
                    valueMax={state.ageTo}
                    defaultMin={PP_AGE_MIN}
                    defaultMax={PP_AGE_MAX}
                    anyLabel={t('no_preference', 'Prefer not to say')}
                    onChange={(ageFrom, ageTo) => setState((current) => ({ ...current, ageFrom, ageTo }))}
                    isDark={isDark}
                    primaryColor={primary}
                    borderColor={colors.brand.bg.border}
                    cardColor={colors.chrome.common.card}
                    mutedColor={colors.chrome.common.textMuted}
                />

                <RangeRow
                    label={t('preferred_height', 'Preferred height')}
                    min={PP_HEIGHT_MIN_CM}
                    max={PP_HEIGHT_MAX_CM}
                    step={1}
                    valueMin={state.heightFrom}
                    valueMax={state.heightTo}
                    defaultMin={PP_HEIGHT_MIN_CM}
                    defaultMax={PP_HEIGHT_MAX_CM}
                    formatValue={formatHeightLabel}
                    anyLabel={t('no_preference', 'Prefer not to say')}
                    onChange={(heightFrom, heightTo) => setState((current) => ({ ...current, heightFrom, heightTo }))}
                    isDark={isDark}
                    primaryColor={primary}
                    borderColor={colors.brand.bg.border}
                    cardColor={colors.chrome.common.card}
                    mutedColor={colors.chrome.common.textMuted}
                />

                <SelectField
                    label={t('preferred_marital_status', 'Preferred marital status')}
                    summary={summaryFor(state.marital, maritalOptions)}
                    hasSelection={state.marital.length > 0}
                    onPress={() => setActiveSheet('marital')}
                />
                <SelectField
                    label={t('preferred_languages', 'Preferred languages')}
                    summary={summaryFor(state.languages, languageOptions)}
                    hasSelection={state.languages.length > 0}
                    onPress={() => setActiveSheet('languages')}
                />
                <SelectField
                    label={t('preferred_ethnicity', 'Preferred ethnicity')}
                    summary={summaryFor(state.ethnic, ethnicOptions)}
                    hasSelection={state.ethnic.length > 0}
                    onPress={() => {
                        if (!ethnicOptions.length) {
                            toast.show(t('profile.field_editor_unavailable', 'Options are still loading. Please try again.'), 'info');
                            return;
                        }
                        setActiveSheet('ethnic');
                    }}
                />

                <View style={[styles.aboutCard, { backgroundColor: colors.chrome.common.card, borderColor: colors.brand.bg.border }]}>
                    <View style={styles.aboutLabelRow}>
                        <Text variant="body-sm" className="font-body-semi">{t('about_partner', 'About partner')}</Text>
                        {aboutPendingReview ? <UnderReviewPill /> : null}
                    </View>
                    <TextInput
                        ref={aboutInputRef}
                        value={state.about}
                        onChangeText={(value) =>
                            setState((current) => ({ ...current, about: trimToCharacterLimit(value, PP_ABOUT_MAX) }))
                        }
                        placeholder={t('about_partner_placeholder', 'Describe the qualities you are looking for')}
                        placeholderTextColor={colors.brand.text.muted}
                        multiline
                        textAlignVertical="top"
                        style={[
                            styles.aboutInput,
                            {
                                color: colors.brand.text.body,
                                borderColor: colors.brand.bg.border,
                                fontFamily: aboutDirection === 'rtl' ? Typography.font.arabic.regular : Typography.font.body.regular,
                                textAlign: aboutDirection === 'rtl' ? 'right' : 'left',
                                writingDirection: aboutDirection,
                            },
                        ]}
                    />
                    <Text
                        variant="caption"
                        style={[styles.aboutCounter, { color: remaining <= 10 ? colors.brand.accent.error : colors.brand.text.muted }]}
                    >
                        {`${remaining} ${t('characters_remaining', 'characters remaining')}`}
                    </Text>
                </View>
            </ScrollView>

            <View style={[styles.footer, { backgroundColor: colors.chrome.header.background, borderTopColor: colors.brand.bg.border }]}>
                <Pressable
                    onPress={clearAll}
                    disabled={saving}
                    accessibilityRole="button"
                    style={[styles.clearButton, { borderColor: colors.brand.bg.border }]}
                >
                    <Text variant="body-sm" className="font-body-semi" style={{ color: colors.brand.text.body }}>
                        {t('clear', 'Clear')}
                    </Text>
                </Pressable>
                <View style={{ flex: 1 }}>
                    <GradientButton
                        title={t('save', 'Save')}
                        onPress={() => void save()}
                        loading={saving}
                        disabled={saving || !dirty}
                        widthMode="full"
                        height={44}
                        textSize={15}
                    />
                </View>
            </View>

            {sheetConfig ? (
                <MultiSelectSheet
                    visible
                    onClose={() => setActiveSheet(null)}
                    onConfirm={(values) => {
                        sheetConfig.apply(values);
                        setActiveSheet(null);
                    }}
                    options={sheetConfig.options}
                    selected={sheetConfig.selected}
                    title={sheetConfig.title}
                    maxSelections={sheetConfig.max}
                    searchEnabled={sheetConfig.searchEnabled}
                    searchPlaceholder={t('search', 'Search...')}
                />
            ) : null}

            <TextModerationWarningModal
                warning={moderationWarning}
                submitting={saving}
                onEdit={() => {
                    setModerationWarning(null);
                    setTimeout(() => aboutInputRef.current?.focus(), 150);
                }}
                onClose={() => setModerationWarning(null)}
                onSubmitAnyway={() => void save(true)}
            />
        </View>
    );
}

function SelectField({
    label,
    summary,
    hasSelection,
    onPress,
}: {
    label: string;
    summary: string;
    hasSelection: boolean;
    onPress: () => void;
}) {
    const colors = useColors();
    const { isRTL } = useLanguage();
    return (
        // Pressable shell only — layout on the inner View (Pressable can drop
        // function/array layout styles on this build)
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${label}, ${summary}`}
            style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
        >
            <View
                style={[
                    styles.selectRow,
                    { backgroundColor: colors.chrome.common.card, borderColor: colors.brand.bg.border },
                ]}
            >
            <View style={styles.selectRowBody}>
                <Text variant="body-sm" className="font-body-bold" style={styles.selectRowTitle}>{label}</Text>
                <Text
                    variant="body-sm"
                    numberOfLines={1}
                    style={{ color: hasSelection ? colors.chrome.primary : colors.chrome.common.textMuted, marginTop: scale(3) }}
                >
                    {summary}
                </Text>
            </View>
            <ChevronRight
                size={19}
                color={colors.chrome.common.textMuted}
                style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }}
            />
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    introCard: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    selectRow: {
        borderWidth: 1,
        borderRadius: 8,
        minHeight: 76,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    selectRowBody: { flex: 1, minWidth: 0 },
    selectRowTitle: { fontSize: 14, lineHeight: 20 },
    aboutCard: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 12,
    },
    aboutLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: scale(8),
        marginBottom: scale(8),
    },
    aboutInput: {
        minHeight: scale(120),
        borderWidth: 1,
        borderRadius: scale(10),
        paddingHorizontal: scale(12),
        paddingTop: scale(10),
        fontSize: scale(14),
        lineHeight: scale(21),
        includeFontPadding: false,
    },
    aboutCounter: {
        marginTop: scale(6),
        textAlign: 'right',
        writingDirection: 'ltr',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(10),
        paddingHorizontal: scale(14),
        paddingVertical: scale(12),
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    clearButton: {
        minWidth: scale(96),
        height: scale(44),
        borderWidth: 1,
        borderRadius: 9999,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: scale(16),
    },
});
