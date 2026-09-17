import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { TextModerationWarningModal } from '@/components/app/TextModerationWarningModal';
import { UnderReviewPill } from '@/components/app/UnderReviewPill';
import { UnderlineTextInput } from '@/components/ui/UnderlineTextInput';
import { TextEditSheet } from '@/components/ui/TextEditSheet';
import { CompletionImpactBadge } from '@/components/profile/CompletionImpactBadge';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { toast } from '@/hooks/useToast';
import { scale } from '@/hooks/useResponsive';
import { Typography } from '@/constants/typography';
import { profileService } from '@/lib/profileService';
import { apiMessage, cleanProfileMultilineText, cleanProfileText, t } from '@/lib/profileDisplay';
import { getTextDirection, localeTextDirection, localeUsesLatinScript } from '@/lib/textDirection';
import {
    getTextModerationWarning,
    moderationCandidateForEditing,
    pendingModerationCandidate,
    TextModerationWarning,
} from '@/lib/textModeration';
import {
    BIO_MIN,
    BIO_MAX,
    HEADLINE_MAX,
    cleanHeadlineTextForSave,
    cleanProfileTextForSave,
    countNonSpace,
    isAllowedProfileText,
    normalizeProfileText,
    plainTextFromFormattedInput,
    trimToNonSpaceLimit,
} from '@/lib/profileValidation';
import { useAuthStore } from '@/store/authStore';

export type SummaryField = 'headline' | 'bio';
export type ProfileSummaryEditorHandle = {
    save: (submitAnyway?: boolean) => Promise<boolean>;
    discard: () => void;
};

type Props = {
    /** Profile object carrying profile_headline / bio / contentModeration. */
    profile: any;
    /** Which fields to edit; defaults to both. */
    fields?: SummaryField[];
    /** Called after a successful save (normal or submit-anyway) so the parent
        can refetch and swap this editor for the displayed content. */
    onSaved?: () => void | Promise<void>;
    /** Publishes a successful save before the background reconciliation. */
    onOptimisticSave?: (patch: Record<string, any>) => void;
    /** Controls save-action placement. Inputs share the same underline style. */
    variant?: 'card' | 'inline';
    /** "+N%" completion badge next to the labels while the field is missing. */
    headlineImpact?: number;
    bioImpact?: number;
    onDirtyChange?: (dirty: boolean) => void;
};

/** Shared Headline + Bio editor used by Edit Profile and My Profile.
    Owns prefill from pending/rejected moderation candidates, validation,
    RTL/LTR direction, the moderation warning modal and submit-anyway. */
export const ProfileSummaryEditor = React.forwardRef<ProfileSummaryEditorHandle, Props>(function ProfileSummaryEditor({
    profile,
    fields = ['headline', 'bio'],
    onSaved,
    onOptimisticSave,
    variant = 'card',
    headlineImpact = 0,
    bioImpact = 0,
    onDirtyChange,
}, ref) {
    const palette = useColors();
    const { currentLanguage, isRTL } = useLanguage();
    const usesLatinLabels = localeUsesLatinScript(currentLanguage);
    const refreshUser = useAuthStore((state) => state.refreshUser);
    const patchUserProfile = useAuthStore((state) => state.patchUserProfile);

    const inline = variant === 'inline';
    const showHeadline = fields.includes('headline');
    const showBio = fields.includes('bio');

    const [headline, setHeadline] = useState('');
    const [bio, setBio] = useState('');
    const [initialValues, setInitialValues] = useState({ headline: '', bio: '' });
    const draftValuesRef = useRef({ headline: '', bio: '' });
    const initialValuesRef = useRef({ headline: '', bio: '' });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [moderationWarning, setModerationWarning] = useState<TextModerationWarning | null>(null);
    const [activeField, setActiveField] = useState<SummaryField | null>(null);
    const [bioExpanded, setBioExpanded] = useState(false);
    const [bioCanExpand, setBioCanExpand] = useState(false);
    const pendingSubmissionRef = useRef<{ field: SummaryField; value: string } | null>(null);
    const headlineInputRef = useRef<TextInput>(null);
    const bioInputRef = useRef<TextInput>(null);

    const moderationMeta = profile?.contentModeration || {};
    const headlinePending = Boolean(pendingModerationCandidate(moderationMeta.profileHeadline));
    const bioPending = Boolean(pendingModerationCandidate(moderationMeta.bio));

    // Prefill with the owner's pending/rejected candidate over the public value
    useEffect(() => {
        const nextHeadline = cleanProfileText(moderationCandidateForEditing(moderationMeta.profileHeadline) || profile?.profile_headline || '');
        const nextBio = cleanProfileMultilineText(moderationCandidateForEditing(moderationMeta.bio) || profile?.bio || '');
        const currentDraft = draftValuesRef.current;
        const currentInitial = initialValuesRef.current;
        const keepHeadlineDraft = currentDraft.headline !== currentInitial.headline;
        const keepBioDraft = currentDraft.bio !== currentInitial.bio;
        const nextInitial = {
            headline: keepHeadlineDraft ? currentInitial.headline : nextHeadline,
            bio: keepBioDraft ? currentInitial.bio : nextBio,
        };

        if (!keepHeadlineDraft) {
            draftValuesRef.current.headline = nextHeadline;
            setHeadline(nextHeadline);
        }
        if (!keepBioDraft) {
            draftValuesRef.current.bio = nextBio;
            setBio(nextBio);
        }
        initialValuesRef.current = nextInitial;
        setInitialValues(nextInitial);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile]);

    // Inline save bar only exists while typing
    useEffect(() => {
        if (!inline) return;
        const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
        return () => {
            show.remove();
            hide.remove();
        };
    }, [inline]);

    const localeDirection = localeTextDirection(currentLanguage);
    const headlineDirection = getTextDirection(headline, localeDirection);
    const bioDirection = getTextDirection(bio, localeDirection);
    const headlineFontFamily = headlineDirection === 'rtl'
        ? Typography.font.arabic.regular
        : Typography.font.body.regular;
    const bioFontFamily = bioDirection === 'rtl'
        ? Typography.font.arabic.regular
        : Typography.font.body.regular;

    const bioCount = countNonSpace(bio);
    const headlineDirty = showHeadline && headline !== initialValues.headline;
    const bioDirty = showBio && bio !== initialValues.bio;
    const dirty = headlineDirty || bioDirty;
    const bioBelowMin = showBio && bioCount > 0 && bioCount < BIO_MIN;
    const canSave = dirty && !saving && !bioBelowMin;

    useEffect(() => {
        onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);

    useEffect(() => {
        setBioExpanded(false);
        setBioCanExpand(false);
    }, [bio]);

    function validate(
        nextHeadline = headline,
        nextBio = bio,
        onlyField?: SummaryField,
    ) {
        const nextErrors: Record<string, string> = {};
        if (showHeadline && (!onlyField || onlyField === 'headline')) {
            const cleaned = cleanHeadlineTextForSave(nextHeadline);
            if (countNonSpace(cleaned) > HEADLINE_MAX) {
                nextErrors.headline = t('headline_too_long', 'Headline is too long.');
            } else if (cleaned && !isAllowedProfileText(cleaned)) {
                nextErrors.headline = t('headline_invalid_chars', 'Headline can only contain letters, numbers, spaces and basic punctuation.');
            }
        }
        if (showBio && (!onlyField || onlyField === 'bio')) {
            const cleaned = cleanProfileTextForSave(nextBio);
            const cleanedCount = countNonSpace(cleaned);
            if (cleanedCount > 0 && cleanedCount < BIO_MIN) {
                nextErrors.bio = t('bio_too_short', `Bio must be at least ${BIO_MIN} characters.`);
            } else if (cleanedCount > BIO_MAX) {
                nextErrors.bio = t('bio_too_long', 'Bio is too long.');
            } else if (cleaned && !isAllowedProfileText(cleaned)) {
                nextErrors.bio = t('bio_invalid_chars', 'Bio can only contain letters, numbers, spaces and basic punctuation.');
            }
        }
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    }

    async function save(
        submitAnyway = false,
        overrides: Partial<Record<SummaryField, string>> = {},
        onlyField?: SummaryField,
    ) {
        const nextHeadline = overrides.headline ?? headline;
        const nextBio = overrides.bio ?? bio;
        if (!validate(nextHeadline, nextBio, onlyField)) return false;
        const nextHeadlineDirty = showHeadline && nextHeadline !== initialValuesRef.current.headline;
        const nextBioDirty = showBio && nextBio !== initialValuesRef.current.bio;
        const submitHeadline = nextHeadlineDirty && (!onlyField || onlyField === 'headline');
        const submitBio = nextBioDirty && (!onlyField || onlyField === 'bio');
        if (!submitHeadline && !submitBio) return false;
        setSaving(true);
        try {
            // Only changed fields are submitted — an unchanged field would
            // trigger pointless AI moderation on the server
            const payload: Record<string, any> = { clientLocale: currentLanguage };
            if (submitHeadline) payload.profile_headline = cleanHeadlineTextForSave(nextHeadline);
            if (submitBio) payload.bio = cleanProfileTextForSave(nextBio);
            if (submitAnyway) payload.submitAnyway = true;

            const res = await profileService.updateProfile(payload);
            if (res.success === false) {
                const warning = getTextModerationWarning(res);
                if (warning) {
                    setModerationWarning(warning);
                } else {
                    toast.show(apiMessage(String(res.message || ''), t('profile.update_error', 'Could not update profile.')), 'error');
                }
                return false;
            }
            setModerationWarning(null);
            pendingSubmissionRef.current = null;
            Keyboard.dismiss();
            // Update baselines immediately so Save disables without waiting
            // for the parent's profile refetch
            const savedValues = {
                headline: submitHeadline ? payload.profile_headline : headline,
                bio: submitBio ? payload.bio : bio,
            };
            setHeadline(savedValues.headline);
            setBio(savedValues.bio);
            draftValuesRef.current = { ...savedValues };
            const nextInitialValues = {
                ...initialValuesRef.current,
                ...(submitHeadline ? { headline: savedValues.headline } : {}),
                ...(submitBio ? { bio: savedValues.bio } : {}),
            };
            initialValuesRef.current = nextInitialValues;
            setInitialValues(nextInitialValues);
            const responseProfile = res.profile || res.user?.profile || {};
            const optimisticPatch = {
                ...responseProfile,
                ...(submitHeadline ? { profile_headline: savedValues.headline } : {}),
                ...(submitBio ? { bio: savedValues.bio } : {}),
            };
            patchUserProfile(optimisticPatch);
            onOptimisticSave?.(optimisticPatch);
            const latestModeration =
                responseProfile.contentModeration
                || useAuthStore.getState().user?.profile?.contentModeration
                || {};
            const savedForReview =
                (submitHeadline && Boolean(pendingModerationCandidate(latestModeration.profileHeadline))) ||
                (submitBio && Boolean(pendingModerationCandidate(latestModeration.bio)));
            toast.show(
                submitAnyway || savedForReview
                    ? t('moderation_submit_anyway_success', 'Submitted for review.')
                    : t('profile.profile_updated', 'Profile updated.'),
                'success',
            );
            setTimeout(() => {
                void Promise.allSettled([
                    refreshUser(),
                    Promise.resolve(onSaved?.()),
                ]);
            }, 0);
            return true;
        } catch {
            toast.show(t('profile.update_error', 'Could not update profile.'), 'error');
            return false;
        } finally {
            setSaving(false);
        }
    }

    function discard() {
        const savedValues = initialValuesRef.current;
        draftValuesRef.current = { ...savedValues };
        setHeadline(savedValues.headline);
        setBio(savedValues.bio);
        setErrors({});
        setModerationWarning(null);
        Keyboard.dismiss();
    }

    React.useImperativeHandle(ref, () => ({ save, discard }));

    function focusModeratedField(field: TextModerationWarning['field'] | undefined) {
        if (!inline) {
            setActiveField(field === 'bio' ? 'bio' : 'headline');
            return;
        }
        const target = field === 'bio' ? bioInputRef : headlineInputRef;
        setTimeout(() => target.current?.focus(), 150);
    }

    const saveActiveField = async (value: string, submitAnyway = false) => {
        if (!activeField) return false;
        const nextValue = activeField === 'bio'
            ? normalizeProfileText(value)
            : value;
        pendingSubmissionRef.current = { field: activeField, value: nextValue };
        const saved = await save(submitAnyway, { [activeField]: nextValue }, activeField);
        if (saved) setActiveField(null);
        return saved;
    };

    if (!inline) {
        const rows = [
            showHeadline ? {
                field: 'headline' as const,
                label: t('profile_headline', 'Profile headline'),
                value: headline,
                placeholder: t('profile.headline_placeholder', 'Write a headline for this profile'),
                pending: headlinePending,
                impact: headlineImpact,
            } : null,
            showBio ? {
                field: 'bio' as const,
                label: t('bio', 'Bio'),
                value: bio,
                placeholder: t('profile.bio_placeholder', 'Share brief description to help others understand you better.'),
                pending: bioPending,
                impact: bioImpact,
            } : null,
        ].filter(Boolean) as Array<{
            field: SummaryField;
            label: string;
            value: string;
            placeholder: string;
            pending: boolean;
            impact: number;
        }>;
        const active = rows.find((row) => row.field === activeField);

        return (
            <View>
                {rows.map((row) => (
                    <Pressable
                        key={row.field}
                        onPress={() => setActiveField(row.field)}
                        accessibilityRole="button"
                        accessibilityLabel={`${row.label}, ${row.value || row.placeholder}`}
                        style={({ pressed }) => (pressed ? { opacity: 0.82 } : null)}
                    >
                        <View
                            style={[
                                styles.editRow,
                                row.field === 'headline' && styles.headlineEditRow,
                            ]}
                        >
                            <View style={styles.editRowBody}>
                                <View style={styles.editRowLabelLine}>
                                    <Text
                                        variant="caption"
                                        className="font-body-bold"
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                        minimumFontScale={0.86}
                                        style={[
                                            styles.editFieldLabel,
                                            usesLatinLabels ? styles.latinFieldLabel : styles.naturalLabel,
                                            { color: palette.chrome.common.textMuted },
                                        ]}
                                    >
                                        {row.label}
                                    </Text>
                                    {row.pending ? <UnderReviewPill iconOnly iconSize={21} /> : null}
                                    {row.impact ? <CompletionImpactBadge value={row.impact} /> : null}
                                </View>
                                <Text
                                    variant="body-sm"
                                    className={row.field === 'headline' && row.value ? 'font-body-semi' : undefined}
                                    numberOfLines={row.field === 'bio' && bioExpanded ? undefined : row.field === 'bio' ? 2 : 1}
                                    ellipsizeMode="tail"
                                    style={[
                                        styles.editRowValue,
                                        row.field === 'headline' && row.value && styles.headlineValue,
                                        row.field === 'bio' && styles.editBioValue,
                                        !row.value && styles.editPlaceholder,
                                        { color: palette.brand.text.body },
                                    ]}
                                >
                                    {row.value || row.placeholder}
                                </Text>
                                {row.field === 'bio' && row.value ? (
                                    <Text
                                        accessible={false}
                                        importantForAccessibility="no-hide-descendants"
                                        onTextLayout={(event) => {
                                            const canExpand = event.nativeEvent.lines.length > 2;
                                            setBioCanExpand((current) => current === canExpand ? current : canExpand);
                                        }}
                                        style={[
                                            styles.editRowValue,
                                            styles.editBioValue,
                                            styles.bioMeasure,
                                        ]}
                                    >
                                        {row.value}
                                    </Text>
                                ) : null}
                                {row.field === 'bio' && bioCanExpand ? (
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={bioExpanded ? t('show_less', 'Show less') : t('read_more', 'Read more')}
                                        hitSlop={8}
                                        onPress={(event) => {
                                            event.stopPropagation();
                                            setBioExpanded((current) => !current);
                                        }}
                                        style={styles.bioExpandButton}
                                    >
                                        <Text
                                            variant="body-sm"
                                            className="font-body-semi"
                                            style={{ color: palette.chrome.primary }}
                                        >
                                            {bioExpanded ? t('less', 'Less') : t('more', 'More')}
                                        </Text>
                                    </Pressable>
                                ) : null}
                            </View>
                            <View pointerEvents="none" style={styles.editRowChevron}>
                                <ChevronRight
                                    size={19}
                                    color={palette.chrome.common.textMuted}
                                    style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }}
                                />
                            </View>
                        </View>
                    </Pressable>
                ))}

                {active ? (
                    <TextEditSheet
                        visible
                        title={active.label}
                        initialValue={active.value}
                        placeholder={active.placeholder}
                        maxNonSpace={active.field === 'bio' ? BIO_MAX : HEADLINE_MAX}
                        multiline={active.field === 'bio'}
                        minInputHeight={scale(active.field === 'bio' ? 150 : 44)}
                        presentation="drawer"
                        saving={saving}
                        pendingReview={active.pending}
                        errorText={errors[active.field] || undefined}
                        sanitizeValue={active.field === 'bio'
                            ? (value) => trimToNonSpaceLimit(plainTextFromFormattedInput(value), BIO_MAX)
                            : (value) => trimToNonSpaceLimit(plainTextFromFormattedInput(value), HEADLINE_MAX)}
                        onDraftChange={() => {
                            if (errors[active.field]) {
                                setErrors((current) => ({ ...current, [active.field]: '' }));
                            }
                        }}
                        onClose={() => {
                            if (!saving) setActiveField(null);
                        }}
                        onSave={(value) => void saveActiveField(value)}
                    />
                ) : null}

                <TextModerationWarningModal
                    warning={moderationWarning}
                    submitting={saving}
                    onEdit={() => {
                        const field = moderationWarning?.field;
                        setModerationWarning(null);
                        focusModeratedField(field);
                    }}
                    onClose={() => setModerationWarning(null)}
                    onSubmitAnyway={() => {
                        const pending = pendingSubmissionRef.current;
                        const field = pending?.field || (moderationWarning?.field === 'bio' ? 'bio' : 'headline');
                        setActiveField(field);
                        void save(true, pending ? { [field]: pending.value } : {}, field).then((saved) => {
                            if (saved) setActiveField(null);
                        });
                    }}
                />
            </View>
        );
    }

    return (
        <View>
            {showHeadline ? (
                <>
                    <View style={styles.labelRow}>
                        <Text
                            variant="caption"
                            className={inline ? 'font-body-semi' : 'font-body-bold'}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.86}
                            style={!inline ? [
                                styles.editFieldLabel,
                                usesLatinLabels ? styles.latinFieldLabel : styles.naturalLabel,
                                { color: palette.chrome.common.textMuted },
                            ] : undefined}
                        >
                            {t('profile_headline', 'Profile headline')}
                        </Text>
                        {headlinePending ? <UnderReviewPill /> : null}
                        {headlineImpact ? <CompletionImpactBadge value={headlineImpact} /> : null}
                        {saving && headlineDirty ? (
                            <View style={styles.savingRow}>
                                <ActivityIndicator size="small" color={palette.chrome.primary} />
                                <Text variant="caption" style={{ color: palette.brand.text.muted }}>
                                    {t('saving', 'Saving…')}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                    <UnderlineTextInput
                        ref={headlineInputRef}
                        value={headline}
                        onChangeText={(value) => {
                            const nextHeadline = trimToNonSpaceLimit(plainTextFromFormattedInput(value), HEADLINE_MAX);
                            draftValuesRef.current.headline = nextHeadline;
                            setHeadline(nextHeadline);
                            if (errors.headline) setErrors((current) => ({ ...current, headline: '' }));
                        }}
                        placeholder={t('profile.headline_placeholder', 'Write a headline for this profile')}
                        placeholderTextColor={palette.brand.text.muted}
                        maxLength={140}
                        error={Boolean(errors.headline)}
                        minInputHeight={scale(44)}
                        style={{
                            fontFamily: headlineFontFamily,
                            textAlign: headlineDirection === 'rtl' ? 'right' : 'left',
                            writingDirection: headlineDirection,
                        }}
                    />
                    {!inline ? (
                        <Text variant="caption" style={[styles.counter, { color: palette.brand.text.muted }]}>
                            {countNonSpace(headline)}/{HEADLINE_MAX}
                        </Text>
                    ) : null}
                    {errors.headline ? <Text variant="caption" style={styles.error}>{errors.headline}</Text> : null}
                </>
            ) : null}

            {showBio ? (
                <>
                    <View style={styles.labelRow}>
                        <Text
                            variant="caption"
                            className={inline ? 'font-body-semi' : 'font-body-bold'}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.86}
                            style={!inline ? [
                                styles.editFieldLabel,
                                usesLatinLabels ? styles.latinFieldLabel : styles.naturalLabel,
                                { color: palette.chrome.common.textMuted },
                            ] : undefined}
                        >
                            {t('bio', 'Bio')}
                        </Text>
                        {bioPending ? <UnderReviewPill /> : null}
                        {bioImpact ? <CompletionImpactBadge value={bioImpact} /> : null}
                        {saving && bioDirty ? (
                            <View style={styles.savingRow}>
                                <ActivityIndicator size="small" color={palette.chrome.primary} />
                                <Text variant="caption" style={{ color: palette.brand.text.muted }}>
                                    {t('saving', 'Saving…')}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                    <UnderlineTextInput
                        ref={bioInputRef}
                        value={bio}
                        onChangeText={(value) => {
                            const nextBio = trimToNonSpaceLimit(plainTextFromFormattedInput(value), BIO_MAX);
                            draftValuesRef.current.bio = nextBio;
                            setBio(nextBio);
                            if (errors.bio) setErrors((current) => ({ ...current, bio: '' }));
                        }}
                        placeholder={t('profile.bio_placeholder', 'Share brief description to help others understand you better.')}
                        placeholderTextColor={palette.brand.text.muted}
                        multiline
                        textAlignVertical="top"
                        maxLength={900}
                        error={Boolean(errors.bio)}
                        minInputHeight={scale(110)}
                        style={{
                            fontFamily: bioFontFamily,
                            textAlign: bioDirection === 'rtl' ? 'right' : 'left',
                            writingDirection: bioDirection,
                        }}
                    />
                    {!inline ? (
                        <Text variant="caption" style={[styles.counter, { color: palette.brand.text.muted }]}>
                            {bioCount}/{BIO_MAX}
                        </Text>
                    ) : null}
                    {errors.bio ? <Text variant="caption" style={styles.error}>{errors.bio}</Text> : null}
                </>
            ) : null}

            {inline ? (
                keyboardVisible ? (
                    <View style={styles.inlineSaveRow}>
                        <Text
                            variant="caption"
                            style={{ color: bioBelowMin ? palette.brand.accent.error : palette.brand.text.muted }}
                        >
                            {showBio
                                ? bioCount < BIO_MIN
                                    ? `${bioCount}/${BIO_MIN} min`
                                    : `${bioCount}/${BIO_MAX}`
                                : `${countNonSpace(headline)}/${HEADLINE_MAX}`}
                        </Text>
                        <View style={styles.inlineSaveButton}>
                            <GradientButton
                                title={t('save', 'Save')}
                                onPress={() => void save()}
                                loading={saving}
                                disabled={!canSave}
                                widthMode="full"
                                height={36}
                                textSize={13}
                            />
                        </View>
                    </View>
                ) : null
            ) : (
                <GradientButton
                    title={t('save', 'Save')}
                    onPress={() => void save()}
                    loading={saving}
                    disabled={!canSave}
                    widthMode="auto"
                    height={40}
                    textSize={14}
                    containerStyle={styles.saveButton}
                />
            )}

            <TextModerationWarningModal
                warning={moderationWarning}
                submitting={saving}
                onEdit={() => {
                    const field = moderationWarning?.field;
                    setModerationWarning(null);
                    focusModeratedField(field);
                }}
                onClose={() => setModerationWarning(null)}
                onSubmitAnyway={() => void save(true)}
            />
        </View>
    );
});

const styles = StyleSheet.create({
    labelRow: {
        alignItems: 'center',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: scale(8),
        marginTop: scale(10),
    },
    editFieldLabel: {
        fontSize: scale(13),
        lineHeight: scale(17),
        flexShrink: 1,
    },
    editRow: {
        minHeight: scale(72),
        paddingVertical: scale(12),
        paddingEnd: scale(29),
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
    },
    headlineEditRow: {
        paddingBottom: scale(16),
    },
    editRowBody: { flex: 1, minWidth: 0, gap: scale(3), position: 'relative' },
    editRowLabelLine: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: scale(8),
    },
    editRowValue: { fontSize: scale(15), lineHeight: scale(21) },
    headlineValue: { fontSize: scale(16) },
    editPlaceholder: { fontSize: scale(14), lineHeight: scale(21), fontWeight: '400' },
    editBioValue: {
        fontSize: scale(14),
        lineHeight: scale(21),
        fontStyle: 'normal',
        fontWeight: '400',
    },
    bioMeasure: {
        position: 'absolute',
        start: 0,
        end: 0,
        top: 0,
        opacity: 0,
        zIndex: -1,
    },
    bioExpandButton: {
        alignSelf: 'flex-start',
        paddingVertical: scale(4),
    },
    editRowChevron: {
        position: 'absolute',
        end: 0,
        top: scale(12),
        alignItems: 'center',
        justifyContent: 'center',
    },
    latinFieldLabel: {
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },
    naturalLabel: {
        textTransform: 'none',
        letterSpacing: 0,
    },
    counter: {
        marginTop: scale(4),
        textAlign: 'right',
    },
    error: {
        marginTop: scale(2),
        color: '#E11D48',
    },
    saveButton: {
        marginTop: scale(12),
        width: scale(140),
        // Logical end: right in LTR, left in RTL.
        alignSelf: 'flex-end',
    },
    // Appears under the focused input while the keyboard is open, so the
    // resized viewport keeps it right above the keyboard
    inlineSaveRow: {
        marginTop: scale(10),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: scale(12),
    },
    inlineSaveButton: {
        width: scale(110),
    },
    savingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(5),
    },
});
