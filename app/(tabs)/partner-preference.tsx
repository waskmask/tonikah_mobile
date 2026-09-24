import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { TextModerationWarningModal } from '@/components/app/TextModerationWarningModal';
import { UnderReviewPill } from '@/components/app/UnderReviewPill';
import { GradientButton } from '@/components/ui/GradientButton';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { MultiSelectSheet } from '@/components/ui/MultiSelectSheet';
import { RangeRow } from '@/components/ui/RangeRow';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextEditSheet } from '@/components/ui/TextEditSheet';
import { useTheme } from '@/hooks/useTheme';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { LANGUAGE_OPTIONS } from '@/constants/profileOptions';
import { apiMessage, t } from '@/lib/profileDisplay';
import { formatProfileOptionLabel } from '@/lib/profileOptionLabels';
import { masterOptions, staticOptions } from '@/lib/exploreFilters';
import {
    buildPartnerPrefPayload,
    buildPartnerPrefPatch,
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
import { cleanProfileTextForSave, plainTextFromFormattedInput } from '@/lib/profileValidation';
import { profileService } from '@/lib/profileService';
import { useAuthStore } from '@/store/authStore';
import { useEmailVerificationGuard } from '@/hooks/useEmailVerificationGuard';
import { useToast } from '@/hooks/useToast';
import { useUnsavedNavigationGuard } from '@/hooks/useUnsavedNavigationGuard';
import { localeUsesLatinScript } from '@/lib/textDirection';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import {
    getTextModerationWarning,
    moderationCandidateForEditing,
    pendingModerationCandidate,
    TextModerationWarning,
} from '@/lib/textModeration';

type SheetKey = 'marital' | 'languages' | 'ethnic' | null;

export default function PartnerPreferenceScreen() {
    const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
    const { isDark } = useTheme();
    const colors = useColors();
    const primary = colors.chrome.primary;
    const { currentLanguage } = useLanguage();
    const { user, refreshUser, patchUserProfile } = useAuthStore();
    const { requireVerified } = useEmailVerificationGuard();
    const toast = useToast();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();

    const [state, setState] = useState<PartnerPrefState>(defaultPartnerPrefState());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [confirmSaving, setConfirmSaving] = useState(false);
    const [activeSheet, setActiveSheet] = useState<SheetKey>(null);
    const [aboutSheetOpen, setAboutSheetOpen] = useState(false);
    const [ethnicMaster, setEthnicMaster] = useState<any[]>([]);
    const [moderationWarning, setModerationWarning] = useState<TextModerationWarning | null>(null);
    const initialLoadRef = useRef(true);
    const baselineRef = useRef<string | null>(null);
    const baselineStateRef = useRef<PartnerPrefState | null>(null);
    const pendingAboutSubmissionRef = useRef<string | null>(null);
    const stateRef = useRef(state);
    stateRef.current = state;
    const returnHref = useMemo(() => {
        const candidate = Array.isArray(returnTo) ? returnTo[0] : returnTo;
        if (
            !candidate ||
            !candidate.startsWith('/') ||
            candidate.includes('://') ||
            candidate.includes('partner-preference')
        ) {
            return '/(tabs)/profile';
        }
        return candidate;
    }, [returnTo]);

    const myGender = String(user?.profile?.gender || '').toLowerCase();
    const aboutModerationMeta = user?.profile?.contentModeration?.partnerPreferenceAboutPartner;
    const aboutPendingReview = Boolean(pendingModerationCandidate(aboutModerationMeta));
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
        try {
            await refreshUser().catch(() => undefined);
            const res = await profileService.fetchPartnerPreference();
            if (res.success !== false) {
                queryClient.setQueryData(
                    queryKeys.profile.partnerPreference,
                    res.partner_preference || {},
                );
            }
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
            const hasLocalDraft = baselineRef.current !== null
                && serializePartnerPrefState(stateRef.current) !== baselineRef.current;
            if (hasLocalDraft) return;
            setState(hydrated);
            stateRef.current = hydrated;
            baselineStateRef.current = hydrated;
            baselineRef.current = serializePartnerPrefState(hydrated);
        } catch (error) {
            toast.show(
                apiMessage(String((error as any)?.message || ''), t('something_went_wrong', 'Something went wrong.')),
                'error',
            );
        } finally {
            setLoading(false);
            initialLoadRef.current = false;
        }
    }, [queryClient, refreshUser, toast]);

    useFocusEffect(
        useCallback(() => {
            void loadPreference();
        }, [loadPreference]),
    );

    const dirty = baselineRef.current !== null && serializePartnerPrefState(state) !== baselineRef.current;
    const leavePartnerPreference = useCallback(() => {
        router.replace(returnHref as any);
    }, [returnHref]);
    const unsavedNavigation = useUnsavedNavigationGuard({
        dirty,
        leaveFallback: leavePartnerPreference,
        redirectRemovalToFallback: true,
    });

    useFocusEffect(
        useCallback(() => {
            const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
                unsavedNavigation.requestClose();
                return true;
            });
            return () => subscription.remove();
        }, [unsavedNavigation.requestClose]),
    );

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
        if (saving) return false;
        if (!requireVerified('save')) return false;
        setSaving(true);
        try {
            const normalizedPayload = buildPartnerPrefPayload(state);
            const payload = baselineStateRef.current
                ? buildPartnerPrefPatch(state, baselineStateRef.current)
                : normalizedPayload;
            const res = await profileService.savePartnerPreference({
                ...payload,
                clientLocale: currentLanguage,
                ...(submitAnyway ? { submitAnyway: true } : {}),
            });
            if (res.success) {
                setModerationWarning(null);
                const nextState = { ...state, about: normalizedPayload.about_partner };
                setState(nextState);
                baselineStateRef.current = nextState;
                // Rebase immediately so Save disables without waiting on refetch
                baselineRef.current = serializePartnerPrefState(nextState);
                await refreshUser();
                const approvedPreference = useAuthStore.getState().user?.profile?.partner_preference
                    || useAuthStore.getState().user?.profile?.partnerPreference
                    || res.partner_preference;
                if (approvedPreference) {
                    queryClient.setQueryData(queryKeys.profile.partnerPreference, approvedPreference);
                }
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
                return true;
            } else {
                const warning = getTextModerationWarning(res);
                if (warning) {
                    setModerationWarning(warning);
                } else {
                    Alert.alert(t('error', 'Error'), apiMessage(res.message));
                }
                return false;
            }
        } catch {
            toast.show(t('something_went_wrong', 'Something went wrong.'), 'error');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const saveAbout = async (value: string, submitAnyway = false) => {
        if (saving) return false;
        if (!requireVerified('save')) return false;
        const nextAbout = trimToCharacterLimit(cleanProfileTextForSave(value), PP_ABOUT_MAX);
        pendingAboutSubmissionRef.current = nextAbout;
        setSaving(true);
        try {
            const res = await profileService.savePartnerPreference({
                about_partner: nextAbout,
                clientLocale: currentLanguage,
                ...(submitAnyway ? { submitAnyway: true } : {}),
            });
            if (res.success === false) {
                const warning = getTextModerationWarning(res);
                if (warning) setModerationWarning(warning);
                else toast.show(apiMessage(String(res.message || ''), t('something_went_wrong', 'Something went wrong.')), 'error');
                return false;
            }

            setModerationWarning(null);
            pendingAboutSubmissionRef.current = null;
            const currentState = stateRef.current;
            const nextState = { ...currentState, about: nextAbout };
            const nextBaseline = {
                ...(baselineStateRef.current || currentState),
                about: nextAbout,
            };
            setState(nextState);
            stateRef.current = nextState;
            baselineStateRef.current = nextBaseline;
            baselineRef.current = serializePartnerPrefState(nextBaseline);
            const currentProfile = useAuthStore.getState().user?.profile || {};
            const nextPartnerPreference = {
                ...(currentProfile.partner_preference || currentProfile.partnerPreference || {}),
                ...(res.partner_preference || {}),
            };
            const optimisticModeration = submitAnyway
                ? {
                    ...(currentProfile.contentModeration || {}),
                    partnerPreferenceAboutPartner: {
                        ...(currentProfile.contentModeration?.partnerPreferenceAboutPartner || {}),
                        moderationStatus: 'pending_review',
                        candidateValue: nextAbout,
                        adminReview: {
                            ...(currentProfile.contentModeration?.partnerPreferenceAboutPartner?.adminReview || {}),
                            status: 'pending',
                        },
                    },
                }
                : currentProfile.contentModeration;
            patchUserProfile({
                partner_preference: nextPartnerPreference,
                ...(optimisticModeration ? { contentModeration: optimisticModeration } : {}),
            });
            const savedForReview = Boolean(
                pendingModerationCandidate(
                    optimisticModeration?.partnerPreferenceAboutPartner,
                ),
            );
            toast.show(
                submitAnyway || savedForReview
                    ? t('moderation_submit_anyway_success', 'Submitted for review.')
                    : t('partner_preference_updated', 'Partner preference updated successfully.'),
                'success',
            );
            setAboutSheetOpen(false);
            setTimeout(() => {
                void refreshUser()
                    .then(() => {
                        const approvedPreference = useAuthStore.getState().user?.profile?.partner_preference
                            || useAuthStore.getState().user?.profile?.partnerPreference;
                        if (approvedPreference) {
                            queryClient.setQueryData(queryKeys.profile.partnerPreference, approvedPreference);
                        }
                    })
                    .catch(() => undefined);
            }, 0);
            return true;
        } catch {
            toast.show(t('something_went_wrong', 'Something went wrong.'), 'error');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const saveAndLeave = async () => {
        if (confirmSaving) return;
        setConfirmSaving(true);
        try {
            const saved = await save();
            if (saved) unsavedNavigation.leave();
            else unsavedNavigation.stay();
        } finally {
            setConfirmSaving(false);
        }
    };

    const clearAll = () => {
        setState(defaultPartnerPrefState());
    };

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.brand.bg.surface }}>
                <AppBackTitleBar
                    title={t('partner_preference', 'Partner Preference')}
                    fallbackHref={returnHref as any}
                    onBack={unsavedNavigation.requestClose}
                />
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.skeletonContainer}
                    showsVerticalScrollIndicator={false}
                    pointerEvents="none"
                >
                    <Skeleton height={scale(68)} borderRadius={8} />
                    <Skeleton height={scale(112)} borderRadius={8} />
                    <Skeleton height={scale(112)} borderRadius={8} />
                    <Skeleton height={scale(76)} borderRadius={8} />
                    <Skeleton height={scale(76)} borderRadius={8} />
                    <Skeleton height={scale(76)} borderRadius={8} />
                    <Skeleton height={scale(174)} borderRadius={8} />
                </ScrollView>
                <View style={[styles.footer, { backgroundColor: colors.chrome.header.background, borderTopColor: colors.brand.bg.border, paddingBottom: Math.max(insets.bottom, scale(12)) }]}>
                    <Skeleton width={scale(96)} height={scale(44)} borderRadius={9999} />
                    <Skeleton height={scale(44)} borderRadius={9999} style={{ flex: 1 }} />
                </View>
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
            <AppBackTitleBar
                title={t('partner_preference', 'Partner Preference')}
                fallbackHref={returnHref as any}
                onBack={unsavedNavigation.requestClose}
            />
            <KeyboardAwareScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                bottomOffset={scale(24)}
            >
                <View style={[styles.introSection, { borderBottomColor: colors.brand.bg.border }]}>
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
                    presentation="band"
                    insetDivider
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
                    presentation="band"
                    insetDivider
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

                <SelectField
                    label={t('looking_for', 'Looking for')}
                    summary={state.about || t('about_partner_placeholder', 'Describe the qualities you are looking for')}
                    hasSelection={Boolean(state.about)}
                    pendingReview={aboutPendingReview}
                    summaryLines={2}
                    accentSelection={false}
                    showDivider={false}
                    onPress={() => setAboutSheetOpen(true)}
                />
            </KeyboardAwareScrollView>

            <View style={[styles.footer, { backgroundColor: colors.chrome.header.background, borderTopColor: colors.brand.bg.border, paddingBottom: Math.max(insets.bottom, scale(12)) }]}>
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
                    allowEmptySelection
                    searchEnabled={sheetConfig.searchEnabled}
                    searchPlaceholder={t('search', 'Search...')}
                />
            ) : null}

            <TextEditSheet
                visible={aboutSheetOpen}
                title={t('about_partner', 'About partner')}
                initialValue={state.about}
                placeholder={t('about_partner_placeholder', 'Describe the qualities you are looking for')}
                maxNonSpace={PP_ABOUT_MAX}
                multiline
                minInputHeight={scale(150)}
                presentation="drawer"
                saving={saving}
                pendingReview={aboutPendingReview}
                sanitizeValue={(value) => trimToCharacterLimit(plainTextFromFormattedInput(value), PP_ABOUT_MAX)}
                countValue={countCharacters}
                onClose={() => {
                    if (!saving) setAboutSheetOpen(false);
                }}
                onSave={(value) => void saveAbout(value)}
            />

            <TextModerationWarningModal
                warning={moderationWarning}
                submitting={saving}
                onEdit={() => {
                    setModerationWarning(null);
                    setAboutSheetOpen(true);
                }}
                onClose={() => setModerationWarning(null)}
                onSubmitAnyway={() => void saveAbout(pendingAboutSubmissionRef.current ?? state.about, true)}
            />

            <ConfirmSheet
                visible={unsavedNavigation.confirmationVisible}
                onClose={unsavedNavigation.stay}
                onCancel={unsavedNavigation.leave}
                onConfirm={() => void saveAndLeave()}
                title={t('unsaved_changes_title', 'Unsaved changes')}
                message={t('unsaved_changes_message', 'Save your changes before leaving?')}
                confirmLabel={t('save', 'Save')}
                cancelLabel={t('discard', 'Discard')}
                confirmLoading={confirmSaving}
            />
        </View>
    );
}

function SelectField({
    label,
    summary,
    hasSelection,
    pendingReview = false,
    summaryLines = 1,
    accentSelection = true,
    showDivider = true,
    onPress,
}: {
    label: string;
    summary: string;
    hasSelection: boolean;
    pendingReview?: boolean;
    summaryLines?: number;
    accentSelection?: boolean;
    showDivider?: boolean;
    onPress: () => void;
}) {
    const colors = useColors();
    const { isRTL, currentLanguage } = useLanguage();
    const usesLatinLabels = localeUsesLatinScript(currentLanguage);
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
                style={styles.selectRow}
            >
            <View style={styles.selectRowBody}>
                <View style={styles.selectLabelLine}>
                    <Text
                        variant="body-sm"
                        className="font-body-bold"
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.86}
                        style={[
                            styles.selectRowTitle,
                            usesLatinLabels ? styles.latinFieldLabel : styles.naturalFieldLabel,
                            { color: colors.chrome.common.textMuted },
                        ]}
                    >
                        {label}
                    </Text>
                    {pendingReview ? <UnderReviewPill iconOnly iconSize={21} /> : null}
                </View>
                <Text
                    variant="body-sm"
                    numberOfLines={summaryLines}
                    style={{
                        color: hasSelection
                            ? accentSelection
                                ? colors.chrome.primary
                                : colors.brand.text.body
                            : colors.chrome.common.textMuted,
                        marginTop: scale(3),
                    }}
                >
                    {summary}
                </Text>
            </View>
            <ChevronRight
                size={19}
                color={colors.chrome.common.textMuted}
                style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }}
            />
            {showDivider ? (
                <View
                    pointerEvents="none"
                    style={[styles.fieldDivider, { backgroundColor: colors.brand.bg.border }]}
                />
            ) : null}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    content: {
        paddingBottom: scale(24),
    },
    skeletonContainer: {
        paddingHorizontal: scale(14),
        paddingTop: scale(14),
        paddingBottom: scale(24),
        gap: scale(12),
    },
    introSection: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: scale(16),
        paddingVertical: scale(16),
    },
    selectRow: {
        minHeight: 76,
        paddingHorizontal: scale(16),
        paddingVertical: scale(16),
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        position: 'relative',
    },
    fieldDivider: {
        position: 'absolute',
        start: scale(16),
        end: scale(16),
        bottom: 0,
        height: StyleSheet.hairlineWidth,
    },
    selectRowBody: { flex: 1, minWidth: 0 },
    selectLabelLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: scale(8) },
    selectRowTitle: { fontSize: 13, lineHeight: 17 },
    latinFieldLabel: { letterSpacing: 1.2, textTransform: 'uppercase' },
    naturalFieldLabel: { letterSpacing: 0, textTransform: 'none' },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(10),
        paddingHorizontal: scale(14),
        paddingVertical: scale(12),
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
