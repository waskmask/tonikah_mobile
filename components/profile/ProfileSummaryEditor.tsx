import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { TextModerationWarningModal } from '@/components/app/TextModerationWarningModal';
import { UnderReviewPill } from '@/components/app/UnderReviewPill';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { toast } from '@/hooks/useToast';
import { scale } from '@/hooks/useResponsive';
import { Typography } from '@/constants/typography';
import { profileService } from '@/lib/profileService';
import { apiMessage, cleanProfileMultilineText, cleanProfileText, t } from '@/lib/profileDisplay';
import { getTextDirection, localeTextDirection } from '@/lib/textDirection';
import {
    extractModerationRejection,
    getTextModerationWarning,
    moderationCandidateForEditing,
    pendingModerationCandidate,
    TextModerationWarning,
} from '@/lib/textModeration';
import {
    BIO_MAX,
    HEADLINE_MAX,
    cleanHeadlineTextForSave,
    cleanProfileTextForSave,
    countNonSpace,
    isAllowedProfileText,
    normalizeProfileText,
    trimToNonSpaceLimit,
} from '@/lib/profileValidation';
import { useAuthStore } from '@/store/authStore';

export type SummaryField = 'headline' | 'bio';
export type ProfileSummaryEditorHandle = {
    save: (submitAnyway?: boolean) => Promise<boolean>;
    discard: () => void;
};

/** Minimum meaningful bio length, enforced in the inline (My Profile) editor */
const BIO_MIN = 30;

type Props = {
    /** Profile object carrying profile_headline / bio / contentModeration. */
    profile: any;
    /** Which fields to edit; defaults to both. */
    fields?: SummaryField[];
    /** Called after a successful save (normal or submit-anyway) so the parent
        can refetch and swap this editor for the displayed content. */
    onSaved?: () => void | Promise<void>;
    /** 'card' (edit-profile): boxed inputs + always-visible save button.
        'inline' (My Profile): underline inputs like the profile-setup steps,
        save bar appears only while the keyboard is open. */
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
    variant = 'card',
    headlineImpact = 0,
    bioImpact = 0,
    onDirtyChange,
}, ref) {
    const palette = useColors();
    const { isDark } = useTheme();
    const { currentLanguage } = useLanguage();
    const refreshUser = useAuthStore((state) => state.refreshUser);

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
    const [focusedField, setFocusedField] = useState<SummaryField | null>(null);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [moderationWarning, setModerationWarning] = useState<TextModerationWarning | null>(null);
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
    const borderColor = palette.brand.bg.border;
    const underlineIdle = isDark ? '#3A332B' : '#E8E1D6';

    const bioCount = countNonSpace(bio);
    const headlineDirty = showHeadline && headline !== initialValues.headline;
    const bioDirty = showBio && bio !== initialValues.bio;
    const dirty = headlineDirty || bioDirty;
    const bioBelowMin = inline && showBio && bioCount > 0 && bioCount < BIO_MIN;
    const canSave = dirty && !saving && !(inline && showBio && bioCount < BIO_MIN);

    useEffect(() => {
        onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);

    function validate() {
        const nextErrors: Record<string, string> = {};
        if (showHeadline) {
            const cleaned = cleanHeadlineTextForSave(headline);
            if (countNonSpace(cleaned) > HEADLINE_MAX) {
                nextErrors.headline = t('headline_too_long', 'Headline is too long.');
            } else if (cleaned && !isAllowedProfileText(cleaned)) {
                nextErrors.headline = t('headline_invalid_chars', 'Headline can only contain letters, numbers, spaces and basic punctuation.');
            }
        }
        if (showBio) {
            const cleaned = cleanProfileTextForSave(bio);
            if (inline && countNonSpace(cleaned) < BIO_MIN) {
                nextErrors.bio = t('bio_too_short', `Bio must be at least ${BIO_MIN} characters.`);
            } else if (countNonSpace(cleaned) > BIO_MAX) {
                nextErrors.bio = t('bio_too_long', 'Bio is too long.');
            } else if (cleaned && !isAllowedProfileText(cleaned)) {
                nextErrors.bio = t('bio_invalid_chars', 'Bio can only contain letters, numbers, spaces and basic punctuation.');
            }
        }
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    }

    async function save(submitAnyway = false) {
        if (!validate()) return false;
        if (!dirty) return false;
        setSaving(true);
        try {
            // Only changed fields are submitted — an unchanged field would
            // trigger pointless AI moderation on the server
            const payload: Record<string, any> = { clientLocale: currentLanguage };
            if (headlineDirty) payload.profile_headline = cleanHeadlineTextForSave(headline);
            if (bioDirty) payload.bio = cleanProfileTextForSave(bio);
            if (submitAnyway) payload.submitAnyway = true;

            const res = await profileService.updateProfile(payload);
            if (res.success === false) {
                const warning = getTextModerationWarning(res);
                if (warning) {
                    // extractModerationRejection maps API field names to the
                    // local headline/bio error keys
                    const rejection = extractModerationRejection(res);
                    if (rejection) setErrors((current) => ({ ...current, ...rejection.fieldErrors }));
                    setModerationWarning(warning);
                } else {
                    toast.show(apiMessage(String(res.message || ''), t('profile.update_error', 'Could not update profile.')), 'error');
                }
                return false;
            }
            setModerationWarning(null);
            Keyboard.dismiss();
            // Update baselines immediately so Save disables without waiting
            // for the parent's profile refetch
            const savedValues = { headline, bio };
            draftValuesRef.current = { ...savedValues };
            initialValuesRef.current = { ...savedValues };
            setInitialValues({ ...savedValues });
            await refreshUser().catch(() => undefined);
            const latestModeration =
                useAuthStore.getState().user?.profile?.contentModeration || {};
            const savedForReview =
                (showHeadline && Boolean(pendingModerationCandidate(latestModeration.profileHeadline))) ||
                (showBio && Boolean(pendingModerationCandidate(latestModeration.bio)));
            toast.show(
                submitAnyway || savedForReview
                    ? t('moderation_submit_anyway_success', 'Submitted for review.')
                    : t('profile.profile_updated', 'Profile updated.'),
                'success',
            );
            await onSaved?.();
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
        const target = field === 'bio' ? bioInputRef : headlineInputRef;
        setTimeout(() => target.current?.focus(), 150);
    }

    function underlineColor(field: SummaryField, hasError: boolean) {
        if (hasError) return palette.brand.accent.error;
        if (focusedField === field) return palette.chrome.primary;
        return underlineIdle;
    }

    const boxedInputStyle = (hasError: boolean) => [
        styles.input,
        {
            borderColor: hasError ? palette.brand.accent.error : borderColor,
            color: palette.brand.text.body,
            fontFamily: headlineFontFamily,
            textAlign: headlineDirection === 'rtl' ? 'right' as const : 'left' as const,
            writingDirection: headlineDirection,
        },
    ];

    return (
        <View>
            {showHeadline ? (
                <>
                    <View style={styles.labelRow}>
                        <Text variant="caption" className="font-body-semi">
                            {t('profile_headline', 'Profile headline')}
                        </Text>
                        {headlinePending ? <UnderReviewPill /> : null}
                        {headlineImpact ? (
                            <View style={[styles.impactBadge, { backgroundColor: palette.chrome.primary }]}>
                                <Text variant="caption" className="font-body-bold" style={styles.impactText}>
                                    {`\u2066+${headlineImpact}%\u2069`}
                                </Text>
                            </View>
                        ) : null}
                        {saving && headlineDirty ? (
                            <View style={styles.savingRow}>
                                <ActivityIndicator size="small" color={palette.chrome.primary} />
                                <Text variant="caption" style={{ color: palette.brand.text.muted }}>
                                    {t('saving', 'Saving…')}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                    <TextInput
                        ref={headlineInputRef}
                        value={headline}
                        onChangeText={(value) => {
                            const nextHeadline = trimToNonSpaceLimit(value, HEADLINE_MAX);
                            draftValuesRef.current.headline = nextHeadline;
                            setHeadline(nextHeadline);
                            if (errors.headline) setErrors((current) => ({ ...current, headline: '' }));
                        }}
                        onFocus={() => setFocusedField('headline')}
                        onBlur={() => setFocusedField((current) => (current === 'headline' ? null : current))}
                        placeholder={t('profile.headline_placeholder', 'Write a headline for this profile')}
                        placeholderTextColor={palette.brand.text.muted}
                        maxLength={140}
                        style={inline
                            ? [
                                styles.inlineInput,
                                {
                                    borderBottomColor: underlineColor('headline', Boolean(errors.headline)),
                                    borderBottomWidth: focusedField === 'headline' ? 1.5 : 1,
                                    color: palette.brand.text.body,
                                    fontFamily: headlineFontFamily,
                                    textAlign: headlineDirection === 'rtl' ? 'right' : 'left',
                                    writingDirection: headlineDirection,
                                },
                            ]
                            : boxedInputStyle(Boolean(errors.headline))}
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
                        <Text variant="caption" className="font-body-semi">
                            {t('bio', 'Bio')}
                        </Text>
                        {bioPending ? <UnderReviewPill /> : null}
                        {bioImpact ? (
                            <View style={[styles.impactBadge, { backgroundColor: palette.chrome.primary }]}>
                                <Text variant="caption" className="font-body-bold" style={styles.impactText}>
                                    {`\u2066+${bioImpact}%\u2069`}
                                </Text>
                            </View>
                        ) : null}
                        {saving && bioDirty ? (
                            <View style={styles.savingRow}>
                                <ActivityIndicator size="small" color={palette.chrome.primary} />
                                <Text variant="caption" style={{ color: palette.brand.text.muted }}>
                                    {t('saving', 'Saving…')}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                    <TextInput
                        ref={bioInputRef}
                        value={bio}
                        onChangeText={(value) => {
                            const nextBio = trimToNonSpaceLimit(normalizeProfileText(value), BIO_MAX);
                            draftValuesRef.current.bio = nextBio;
                            setBio(nextBio);
                            if (errors.bio) setErrors((current) => ({ ...current, bio: '' }));
                        }}
                        onFocus={() => setFocusedField('bio')}
                        onBlur={() => setFocusedField((current) => (current === 'bio' ? null : current))}
                        placeholder={t('profile.bio_placeholder', 'Share brief description to help others understand you better.')}
                        placeholderTextColor={palette.brand.text.muted}
                        multiline
                        textAlignVertical="top"
                        maxLength={900}
                        style={[
                            inline
                                ? [
                                    styles.inlineTextarea,
                                    {
                                        borderBottomColor: underlineColor('bio', Boolean(errors.bio)),
                                        borderBottomWidth: focusedField === 'bio' ? 1.5 : 1,
                                    },
                                ]
                                : [styles.textarea, { borderColor: errors.bio ? palette.brand.accent.error : borderColor }],
                            {
                                color: palette.brand.text.body,
                                fontFamily: bioFontFamily,
                                textAlign: bioDirection === 'rtl' ? 'right' : 'left',
                                writingDirection: bioDirection,
                            },
                        ]}
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
    input: {
        marginTop: scale(10),
        minHeight: scale(44),
        borderWidth: 1,
        borderRadius: scale(12),
        paddingHorizontal: scale(12),
        paddingVertical: 0,
        fontSize: scale(14),
        lineHeight: scale(21),
        includeFontPadding: false,
    },
    textarea: {
        marginTop: scale(10),
        minHeight: scale(110),
        borderWidth: 1,
        borderRadius: scale(12),
        paddingHorizontal: scale(12),
        paddingVertical: scale(10),
        fontSize: scale(14),
        lineHeight: scale(21),
        includeFontPadding: false,
    },
    // Underline style, matching the profile-setup step inputs
    inlineInput: {
        marginTop: scale(6),
        minHeight: scale(44),
        paddingHorizontal: scale(6),
        paddingVertical: 0,
        fontSize: scale(14),
        lineHeight: scale(21),
        includeFontPadding: false,
        backgroundColor: 'transparent',
    },
    inlineTextarea: {
        marginTop: scale(6),
        minHeight: scale(96),
        paddingHorizontal: scale(6),
        paddingVertical: scale(8),
        fontSize: scale(14),
        lineHeight: scale(21),
        includeFontPadding: false,
        backgroundColor: 'transparent',
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
    impactBadge: {
        height: scale(24),
        borderRadius: 999,
        paddingHorizontal: scale(8),
        alignItems: 'center',
        justifyContent: 'center',
    },
    impactText: {
        color: '#FFFFFF',
        fontSize: scale(11),
        lineHeight: scale(14),
        includeFontPadding: false,
        writingDirection: 'ltr',
    },
    savingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(5),
    },
});
