import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    BackHandler,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { GradientButton } from '@/components/ui/GradientButton';
import { InlineLoadError } from '@/components/ui/InlineLoadError';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { useEmailVerificationGuard } from '@/hooks/useEmailVerificationGuard';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { firstSearchParam, sanitizeAuthReturnPath } from '@/lib/authReturn';
import { emojiChipItem } from '@/lib/profileEmoji';
import { apiMessage, t } from '@/lib/profileDisplay';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { profileService } from '@/lib/profileService';
import { useAuthStore } from '@/store/authStore';

const HOBBIES_LIMIT = 5;
const FAITH_LIMIT = 9;

type SectionKind = 'hobbies' | 'faith';
type ChipOption = { value: string; label: string; emoji: string };

function selectedIds(items: any[] | undefined) {
    if (!Array.isArray(items)) return [];
    return items
        .map((item) => String(item?.value_id || item?._id || item || ''))
        .filter(Boolean);
}

function sameIds(left: string[], right: string[]) {
    if (left.length !== right.length) return false;
    const rightSet = new Set(right);
    return left.every((id) => rightSet.has(id));
}

function normalizeOptions(data: any, kind: SectionKind): ChipOption[] {
    const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    return items
        .map((item: any) => {
            const value = String(item?._id || item?.value_id || '');
            const chip = emojiChipItem(item, kind === 'hobbies' ? 'hobby' : 'faith');
            return { value, label: chip.label, emoji: chip.emoji };
        })
        .filter((item: ChipOption) => item.value && item.label);
}

export default function HobbiesFaithScreen() {
    const params = useLocalSearchParams<{
        section?: string | string[];
        returnTo?: string | string[];
    }>();
    const colors = useColors();
    const { currentLanguage } = useLanguage();
    const toast = useToast();
    const { requireVerified } = useEmailVerificationGuard();
    const authUser = useAuthStore((state) => state.user);
    const refreshUser = useAuthStore((state) => state.refreshUser);
    const setUser = useAuthStore((state) => state.setUser);
    const scrollRef = useRef<ScrollView>(null);
    const targetSection = firstSearchParam(params.section) === 'faith' ? 'faith' : 'hobbies';
    const returnHref = sanitizeAuthReturnPath(
        firstSearchParam(params.returnTo),
        '/(tabs)/edit-profile',
    );
    const profile = authUser?.profile;
    const cachedMasterdata = queryClient.getQueryData<Record<string, any[]>>(
        queryKeys.masterdata.editProfile(currentLanguage),
    );
    const cachedHobbyOptions = normalizeOptions(cachedMasterdata?.hobbies, 'hobbies');
    const cachedFaithOptions = normalizeOptions(cachedMasterdata?.faith_in_daily_life, 'faith');
    const startingHobbies = selectedIds(profile?.hobbies);
    const startingFaith = selectedIds(profile?.faith_in_daily_life);

    const [hobbyOptions, setHobbyOptions] = useState<ChipOption[]>(cachedHobbyOptions);
    const [faithOptions, setFaithOptions] = useState<ChipOption[]>(cachedFaithOptions);
    const [hobbies, setHobbies] = useState<string[]>(startingHobbies);
    const [faith, setFaith] = useState<string[]>(startingFaith);
    const [initialHobbies, setInitialHobbies] = useState<string[]>(startingHobbies);
    const [initialFaith, setInitialFaith] = useState<string[]>(startingFaith);
    const [hobbiesLoading, setHobbiesLoading] = useState(cachedHobbyOptions.length === 0);
    const [faithLoading, setFaithLoading] = useState(cachedFaithOptions.length === 0);
    const [hobbiesError, setHobbiesError] = useState(false);
    const [faithError, setFaithError] = useState(false);
    const [saving, setSaving] = useState(false);
    const [returningAfterSave, setReturningAfterSave] = useState(false);
    const [discarding, setDiscarding] = useState(false);
    const [discardOpen, setDiscardOpen] = useState(false);
    const [faithOffset, setFaithOffset] = useState<number | null>(null);

    const hobbiesDirty = !sameIds(hobbies, initialHobbies);
    const faithDirty = !sameIds(faith, initialFaith);
    const dirty = hobbiesDirty || faithDirty;

    const loadOptions = useCallback(async (kind: SectionKind) => {
        const isHobbies = kind === 'hobbies';
        const setLoading = isHobbies ? setHobbiesLoading : setFaithLoading;
        const setError = isHobbies ? setHobbiesError : setFaithError;
        setLoading(true);
        setError(false);

        try {
            const masterType = isHobbies ? 'hobbies' : 'faith_in_daily_life';
            const response = await profileService.fetchMasterdata(masterType);
            if (!response.success) throw new Error(response.message || `${masterType}_failed`);
            const options = normalizeOptions(response.data || response, kind);
            if (!options.length) throw new Error(`${masterType}_empty`);

            if (isHobbies) setHobbyOptions(options);
            else setFaithOptions(options);

            queryClient.setQueryData<Record<string, any[]>>(
                queryKeys.masterdata.editProfile(currentLanguage),
                (current = {}) => ({ ...current, [masterType]: response.data || [] }),
            );
        } catch {
            const hasCachedOptions = isHobbies ? hobbyOptions.length > 0 : faithOptions.length > 0;
            if (!hasCachedOptions) setError(true);
        } finally {
            setLoading(false);
        }
    }, [currentLanguage, faithOptions.length, hobbyOptions.length]);

    useEffect(() => {
        void loadOptions('hobbies');
        void loadOptions('faith');
        // Initial load only; retries call loadOptions directly.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (targetSection !== 'faith' || hobbiesLoading || faithLoading || faithOffset === null) return;
        const timeout = setTimeout(() => {
            scrollRef.current?.scrollTo({ y: Math.max(0, faithOffset - scale(12)), animated: false });
        }, 80);
        return () => clearTimeout(timeout);
    }, [faithLoading, faithOffset, hobbiesLoading, targetSection]);

    const toggle = (kind: SectionKind, value: string) => {
        const values = kind === 'hobbies' ? hobbies : faith;
        const setValues = kind === 'hobbies' ? setHobbies : setFaith;
        const limit = kind === 'hobbies' ? HOBBIES_LIMIT : FAITH_LIMIT;
        if (values.includes(value)) {
            setValues(values.filter((id) => id !== value));
            return;
        }
        if (values.length >= limit) {
            toast.show(
                kind === 'hobbies'
                    ? t('select_limit_5', 'Selection limit reached. You can choose up to 5 hobbies.')
                    : t('select_limit_9', 'Selection limit reached. You can choose up to 9 options.'),
                'warning',
            );
            return;
        }
        setValues([...values, value]);
    };

    const save = async () => {
        if (!dirty || saving || !requireVerified('save')) return false;
        if ((hobbiesDirty && hobbies.length === 0) || (faithDirty && faith.length === 0)) {
            toast.show(t('select_at_least_one', 'Select at least one option.'), 'warning');
            return false;
        }

        setSaving(true);
        try {
            const [hobbiesResult, faithResult] = await Promise.all([
                hobbiesDirty ? profileService.saveHobbies(hobbies) : Promise.resolve(null),
                faithDirty ? profileService.saveFaithInDailyLife(faith) : Promise.resolve(null),
            ]);

            const hobbiesSaved = !hobbiesResult || hobbiesResult.success;
            const faithSaved = !faithResult || faithResult.success;
            if (hobbiesResult?.success) setInitialHobbies([...hobbies]);
            if (faithResult?.success) setInitialFaith([...faith]);

            if (authUser && (hobbiesResult?.success || faithResult?.success)) {
                setUser({
                    ...authUser,
                    profile: {
                        ...authUser.profile,
                        ...(hobbiesResult?.success ? { hobbies: hobbiesResult.hobbies || authUser.profile?.hobbies } : {}),
                        ...(faithResult?.success ? { faith_in_daily_life: faithResult.faith || authUser.profile?.faith_in_daily_life } : {}),
                    },
                });
                void refreshUser().catch(() => undefined);
            }

            if (!hobbiesSaved || !faithSaved) {
                const failed = !hobbiesSaved ? hobbiesResult : faithResult;
                toast.show(apiMessage(failed?.message), 'error');
                return false;
            }

            toast.show(t('hobbies_faith_updated', 'Hobbies and faith updated.'), 'success', 3000);
            return true;
        } catch {
            toast.show(t('network_error', 'No internet connection. Please check and try again.'), 'error');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const leave = useCallback(() => {
        if (router.canGoBack()) {
            router.back();
            return;
        }
        router.replace(returnHref as any);
    }, [returnHref]);

    const saveAndReturn = async () => {
        const saved = await save();
        if (!saved) return;
        setReturningAfterSave(true);
        requestAnimationFrame(() => {
            leave();
            setTimeout(() => {
                setReturningAfterSave(false);
                setDiscardOpen(false);
            }, 500);
        });
    };

    const discardAndReturn = useCallback(() => {
        if (discarding) return;
        setDiscarding(true);
        requestAnimationFrame(() => {
            setHobbies([...initialHobbies]);
            setFaith([...initialFaith]);
            leave();
            setTimeout(() => {
                setDiscarding(false);
                setDiscardOpen(false);
            }, 500);
        });
    }, [discarding, initialFaith, initialHobbies, leave]);

    const close = useCallback(() => {
        if (dirty) {
            setDiscardOpen(true);
            return;
        }
        leave();
    }, [dirty, leave]);

    useFocusEffect(
        useCallback(() => {
            const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
                close();
                return true;
            });
            return () => subscription.remove();
        }, [close]),
    );

    const renderSection = (
        kind: SectionKind,
        title: string,
        options: ChipOption[],
        selected: string[],
        loading: boolean,
        error: boolean,
        limit: number,
    ) => (
        <View
            style={[styles.section, { borderTopColor: colors.brand.bg.border }]}
            onLayout={kind === 'faith' ? (event) => setFaithOffset(event.nativeEvent.layout.y) : undefined}
        >
            <View style={styles.sectionHeader}>
                <Text variant="body" className="font-body-bold" style={styles.sectionTitle}>
                    {title}
                </Text>
                <Text variant="caption" style={[styles.count, { color: colors.brand.text.muted }]}>
                    {`\u2066${selected.length}/${limit}\u2069`}
                </Text>
            </View>

            {loading && options.length === 0 ? (
                <View style={styles.sectionLoading}>
                    <ActivityIndicator color={colors.chrome.primary} />
                </View>
            ) : error ? (
                <View style={styles.sectionError}>
                    <InlineLoadError
                        title={t('options_load_error', 'Could not load options')}
                        description={t('server_error_default', 'Something went wrong. Please try again.')}
                        retryLabel={t('btn_try_again', 'Try Again')}
                        onRetry={() => void loadOptions(kind)}
                        retrying={loading}
                    />
                </View>
            ) : (
                <View style={styles.pills}>
                    {options.map((option) => {
                        const active = selected.includes(option.value);
                        return (
                            <View
                                key={option.value}
                                style={[
                                    styles.pill,
                                    {
                                        backgroundColor: active
                                            ? colors.chrome.common.primaryTint
                                            : colors.chrome.common.card,
                                    },
                                ]}
                            >
                                <Pressable
                                    onPress={() => toggle(kind, option.value)}
                                    accessibilityRole="checkbox"
                                    accessibilityLabel={option.label}
                                    accessibilityState={{ checked: active }}
                                    style={({ pressed }) => [
                                        styles.pillPressable,
                                        pressed
                                            ? {
                                                backgroundColor: active
                                                    ? colors.chrome.common.card
                                                    : colors.chrome.common.primaryTint,
                                                opacity: 0.82,
                                                transform: [{ scale: 0.98 }],
                                            }
                                            : null,
                                    ]}
                                >
                                    <View style={styles.pillContent}>
                                        <Text style={styles.emoji}>{option.emoji}</Text>
                                        <Text
                                            variant="body-sm"
                                            className={active ? 'font-body-semi' : 'font-body-medium'}
                                            numberOfLines={1}
                                            style={[
                                                styles.pillLabel,
                                                { color: active ? colors.chrome.primary : colors.brand.text.body },
                                            ]}
                                        >
                                            {option.label}
                                        </Text>
                                    </View>
                                </Pressable>
                            </View>
                        );
                    })}
                </View>
            )}
        </View>
    );

    return (
        <View style={[styles.screen, { backgroundColor: colors.brand.bg.surface }]}>
            <AppBackTitleBar
                title={t('hobbies_and_faith', 'Hobbies & Faith')}
                fallbackHref={returnHref}
                onBack={close}
            />
            <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content}>
                {renderSection(
                    'hobbies',
                    t('hobbies', 'Hobbies'),
                    hobbyOptions,
                    hobbies,
                    hobbiesLoading,
                    hobbiesError,
                    HOBBIES_LIMIT,
                )}
                {renderSection(
                    'faith',
                    t('faith_in_daily_life', 'Faith in Daily Life'),
                    faithOptions,
                    faith,
                    faithLoading,
                    faithError,
                    FAITH_LIMIT,
                )}
            </ScrollView>
            <SafeAreaView
                edges={['bottom']}
                style={[styles.footer, { backgroundColor: colors.chrome.header.background, borderTopColor: colors.brand.bg.border }]}
            >
                <GradientButton
                    title={t('save', 'Save')}
                    onPress={() => void saveAndReturn()}
                    loading={saving || returningAfterSave}
                    disabled={saving || returningAfterSave || !dirty}
                    widthMode="full"
                    height={44}
                    textSize={15}
                />
            </SafeAreaView>
            <ConfirmSheet
                visible={discardOpen}
                onClose={() => {
                    if (!saving && !returningAfterSave && !discarding) setDiscardOpen(false);
                }}
                onCancel={discardAndReturn}
                onConfirm={() => void saveAndReturn()}
                title={t('unsaved_changes_title', 'Unsaved changes')}
                message={t('unsaved_changes_message', 'Save your changes before leaving?')}
                confirmLabel={t('save', 'Save')}
                cancelLabel={t('discard', 'Discard')}
                confirmLoading={saving || returningAfterSave}
                cancelLoading={discarding}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    scroll: { flex: 1 },
    content: { paddingBottom: scale(24) },
    section: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: scale(16),
        paddingTop: scale(20),
        paddingBottom: scale(24),
    },
    sectionHeader: {
        minHeight: scale(28),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: scale(12),
        marginBottom: scale(14),
    },
    sectionTitle: {
        flex: 1,
        minWidth: 0,
        fontSize: scale(16),
        lineHeight: scale(21),
    },
    count: {
        flexShrink: 0,
        writingDirection: 'ltr',
    },
    sectionLoading: {
        minHeight: scale(120),
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionError: {
        minHeight: scale(150),
        justifyContent: 'center',
    },
    pills: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: scale(7),
        rowGap: scale(8),
    },
    pill: {
        borderRadius: 9999,
        overflow: 'hidden',
        alignSelf: 'flex-start',
        maxWidth: '100%',
    },
    pillPressable: {
        borderRadius: 9999,
    },
    pillContent: {
        paddingHorizontal: scale(10),
        paddingVertical: scale(6),
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(5),
    },
    emoji: {
        flexShrink: 0,
        fontSize: scale(13),
        lineHeight: scale(18),
        textAlign: 'center',
    },
    pillLabel: {
        flexShrink: 1,
        lineHeight: scale(18),
    },
    footer: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: scale(20),
        paddingTop: scale(12),
        paddingBottom: scale(10),
    },
});
