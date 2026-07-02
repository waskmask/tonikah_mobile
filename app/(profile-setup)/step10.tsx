import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { ArrowUp, ImagePlus, Lock, Pencil, Trash2, Unlock } from 'lucide-react-native';
import { GalleryCropModal } from '@/components/app/GalleryCropModal';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ProfileSetupHeader } from '@/components/ui/ProfileSetupHeader';
import { ErrorText, FieldLabel } from '@/components/ui/FormField';
import { useTheme } from '@/hooks/useTheme';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { ProfileSetupTokens } from '@/constants/uiTokens';
import { Typography } from '@/constants/typography';
import { profileService } from '@/lib/profileService';
import { galleryService, GalleryItem, GalleryPrivacy } from '@/lib/galleryService';
import { translateApiError } from '@/lib/apiErrorTranslator';
import { BIO_MAX, HEADLINE_MAX, cleanHeadlineTextForSave, cleanProfileTextForSave, countNonSpace, isAllowedProfileText, normalizeProfileText, trimToNonSpaceLimit } from '@/lib/profileValidation';
import { useProfileSetupStore } from '@/store/profileSetupStore';
import { useAuthStore } from '@/store/authStore';

const GALLERY_MAX_SLOTS = 3;
const GALLERY_SOURCE_MAX_BYTES = 15 * 1024 * 1024;

type CropDraft = {
    slotIndex: number;
    uri: string;
    width?: number;
    height?: number;
};

function imageUrl(item: GalleryItem | null) {
    return item?.urls?.small || item?.urls?.thumb || item?.urls?.original || item?.url || '';
}

function translated(t: (key: string, options?: any) => string, key: string, fallback: string, options?: any) {
    const value = t(key, options);
    return value && value !== key ? value : fallback;
}

function template(text: string, values: Record<string, string | number>) {
    return Object.entries(values).reduce(
        (next, [key, value]) => next.replaceAll(`{${key}}`, String(value)).replaceAll(`{{${key}}}`, String(value)),
        text,
    );
}

export default function Step10() {
    const { t } = useTranslation('common');
    const { isDark } = useTheme();
    const colors = useColors();
    const { currentLanguage } = useLanguage();
    const { gender, profileData, setProfileData, reset } = useProfileSetupStore();
    const { user, refreshUser } = useAuthStore();

    const [headline, setHeadline] = useState('');
    const [bio, setBio] = useState('');
    const [privacy, setPrivacy] = useState<GalleryPrivacy>('public');
    const [gallery, setGallery] = useState<GalleryItem[]>([]);
    const [loadingGallery, setLoadingGallery] = useState(true);
    const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
    const [updatingPrivacy, setUpdatingPrivacy] = useState(false);
    const [deletingUuid, setDeletingUuid] = useState<string | null>(null);
    const [reordering, setReordering] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [cropDraft, setCropDraft] = useState<CropDraft | null>(null);
    const [cropError, setCropError] = useState<string | null>(null);
    const [localPreviews, setLocalPreviews] = useState<Record<number, string>>({});
    const profileGender = String(gender || profileData.gender || user?.profile?.gender || '').toLowerCase();
    const canUsePrivateGallery = profileGender === 'female';

    const slots = useMemo(
        () => Array.from({ length: GALLERY_MAX_SLOTS }, (_, index) => gallery[index] ?? null),
        [gallery]
    );

    useEffect(() => {
        void refreshGallery(true);
    }, []);

    useEffect(() => {
        if (!message || message.type !== 'success') return;

        const timeoutId = setTimeout(() => {
            setMessage(null);
        }, 4000);

        return () => clearTimeout(timeoutId);
    }, [message]);

    async function refreshGallery(showLoading = false) {
        if (showLoading) setLoadingGallery(true);
        const res = await galleryService.fetchMe();
        if (res.privacy) setPrivacy(canUsePrivateGallery || res.privacy === 'private' ? res.privacy : 'public');
        if (Array.isArray(res.gallery)) setGallery(res.gallery);
        if (showLoading) setLoadingGallery(false);
        return res;
    }

    function validate() {
        const nextErrors: Record<string, string> = {};
        const cleanedHeadline = cleanHeadlineTextForSave(headline);
        const cleanedBio = cleanProfileTextForSave(bio);

        if (countNonSpace(cleanedHeadline) > HEADLINE_MAX) {
            nextErrors.headline = t('headline_too_long');
        } else if (cleanedHeadline && !isAllowedProfileText(cleanedHeadline)) {
            nextErrors.headline = t('headline_invalid_chars', { defaultValue: 'Headline can only contain letters, numbers, spaces and basic punctuation.' });
        }

        if (countNonSpace(cleanedBio) > BIO_MAX) {
            nextErrors.bio = t('bio_too_long');
        } else if (cleanedBio && !isAllowedProfileText(cleanedBio)) {
            nextErrors.bio = t('bio_invalid_chars', { defaultValue: 'Bio can only contain letters, numbers, spaces and basic punctuation.' });
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    }

    async function pickImage(slotIndex: number) {
        if (gallery.length >= GALLERY_MAX_SLOTS && !gallery[slotIndex]) {
            setMessage({ type: 'error', text: translated(t, 'gallery_limit_reached', 'Gallery limit reached.') });
            return;
        }

        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            setMessage({ type: 'error', text: translated(t, 'photo_permission_required', 'Photo library permission is required.') });
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 1,
            exif: false,
        });

        if (result.canceled || !result.assets[0]) return;

        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize > GALLERY_SOURCE_MAX_BYTES) {
            setMessage({ type: 'error', text: t('max_15mb_each') });
            return;
        }

        setMessage(null);
        setCropError(null);
        setCropDraft({
            slotIndex,
            uri: asset.uri,
            width: asset.width,
            height: asset.height,
        });
    }

    async function uploadCroppedImage(uri: string) {
        if (!cropDraft) return;

        const slotIndex = cropDraft.slotIndex;
        setUploadingSlot(slotIndex);
        setMessage(null);
        setCropError(null);
        setLocalPreviews((current) => ({ ...current, [slotIndex]: uri }));

        try {
            const formData = new FormData();
            formData.append('image', {
                uri,
                name: 'gallery.jpg',
                type: 'image/jpeg',
            } as any);

            const replaceUuid = gallery[slotIndex]?.uuid;
            if (replaceUuid) {
                const removeRes = await galleryService.remove(replaceUuid);
                if (!removeRes.success && removeRes.status && removeRes.status >= 400) {
                    throw new Error(removeRes.message || 'gallery_upload_error');
                }
            }

            const uploadRes = await galleryService.upload(formData);
            const uploadedUuid = uploadRes.image?.uuid;
            if (!uploadRes.success || !uploadedUuid) {
                throw new Error(uploadRes.message || 'upload_failed');
            }

            const galleryRes = await refreshGallery(false);
            if (!galleryRes.success && galleryRes.status && galleryRes.status >= 400) {
                throw new Error(galleryRes.message || 'gallery_upload_error');
            }

            const confirmed = Array.isArray(galleryRes.gallery)
                && galleryRes.gallery.some((item) => item.uuid === uploadedUuid);
            if (!confirmed) {
                throw new Error('gallery_upload_not_confirmed');
            }

            if (galleryRes.gallery?.[slotIndex]) {
                setLocalPreviews((current) => {
                    const next = { ...current };
                    delete next[slotIndex];
                    return next;
                });
            }
            setCropDraft(null);
            setCropError(null);
            setMessage({
                type: 'success',
                text: translated(t, 'gallery_photo_uploaded_success', 'Photo uploaded successfully.'),
            });
        } catch (error: any) {
            setLocalPreviews((current) => {
                const next = { ...current };
                delete next[slotIndex];
                return next;
            });
            const key = error?.message || 'gallery_upload_error';
            const text = key === 'gallery_upload_not_confirmed'
                ? translated(t, 'gallery_upload_error', 'Gallery upload error')
                : translateApiError(key);
            setCropError(text);
            setMessage({ type: 'error', text });
        } finally {
            setUploadingSlot(null);
        }
    }

    async function removeImage(uuid: string) {
        setDeletingUuid(uuid);
        setMessage(null);
        const res = await galleryService.remove(uuid);
        if (res.success || !res.status || res.status < 400) {
            await refreshGallery(false);
            setMessage({
                type: 'success',
                text: translated(t, 'gallery_photo_deleted_success', 'Photo removed successfully.'),
            });
        } else {
            setMessage({ type: 'error', text: translated(t, res.message || 'something_went_wrong', 'Something went wrong.') });
        }
        setDeletingUuid(null);
    }

    async function moveImageUp(index: number) {
        if (index <= 0) return;
        const ordered = [...gallery];
        [ordered[index - 1], ordered[index]] = [ordered[index], ordered[index - 1]];
        setGallery(ordered);
        setReordering(true);
        const res = await galleryService.reorder(ordered.map((item) => item.uuid));
        if (!res.success && res.status && res.status >= 400) {
            await refreshGallery(false);
            setMessage({ type: 'error', text: translated(t, res.message || 'something_went_wrong', 'Something went wrong.') });
        }
        setReordering(false);
    }

    async function togglePrivacy() {
        const next = privacy === 'private' ? 'public' : 'private';
        if (next === 'private' && !canUsePrivateGallery) return;
        const previous = privacy;
        setPrivacy(next);
        setUpdatingPrivacy(true);
        const res = await galleryService.updatePrivacy(next);
        if (res.success || !res.status || res.status < 400) {
            setMessage({
                type: 'success',
                text: template(t('privacy_updated_to'), { pkey: t(`privacy_${next}`) }),
            });
        } else {
            setPrivacy(previous);
            setMessage({ type: 'error', text: translated(t, res.message || 'privacy_error', 'Could not update privacy.') });
        }
        setUpdatingPrivacy(false);
    }

    async function handleSubmit() {
        if (!validate()) return;
        setSubmitting(true);

        const payload = {
            profile_headline: cleanHeadlineTextForSave(headline),
            bio: cleanProfileTextForSave(bio),
            newProfile: false,
        };

        const res = await profileService.updateProfile(payload);
        if (res.success) {
            setProfileData(payload);
            await refreshUser();
            reset();
            router.replace('/(tabs)/search');
        } else {
            Alert.alert(t('error'), translated(t, res.message || 'something_went_wrong', 'Something went wrong.'));
        }

        setSubmitting(false);
    }

    const iconColor = colors.brand.text.subtitle;
    const borderColor = colors.brand.bg.border;
    const inputBackground = colors.chrome.common.card;
    const inputFontFamily = currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.regular;

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
            <ProgressBar currentStep={10} />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView
                    contentContainerStyle={ProfileSetupTokens.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <ProfileSetupHeader
                        step={10}
                        title={translated(t, 'profile_summary', 'Photos and Profile Summary')}
                        subtitle={translated(t, 'profile_summary_desc', 'Add images, your headline and a short bio to personalize the profile.')}
                    />

                    <FieldLabel text={t('photo_gallery')} />
                    {loadingGallery ? (
                        <View style={styles.loadingBox}>
                            <ActivityIndicator color={colors.chrome.primary} />
                        </View>
                    ) : (
                        <View style={styles.galleryGrid}>
                            {slots.map((item, index) => {
                                const uri = imageUrl(item) || localPreviews[index];
                                const busy = uploadingSlot === index || deletingUuid === item?.uuid || reordering;
                                return (
                                    <Pressable
                                        key={item?.uuid || index}
                                        onPress={() => pickImage(index)}
                                        disabled={busy}
                                        style={[styles.slot, { borderColor, backgroundColor: inputBackground }]}
                                    >
                                        {uri ? (
                                            <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                                        ) : (
                                            <View style={styles.emptySlot}>
                                                <ImagePlus size={scale(26)} color={iconColor} />
                                                <Text variant="caption" align="center" style={{ color: colors.brand.text.subtitle }}>
                                                    {template(t('add_photo_slot'), { number: index + 1 })}
                                                </Text>
                                            </View>
                                        )}

                                        {busy && (
                                            <View style={styles.busyOverlay}>
                                                <ActivityIndicator color={colors.chrome.common.inverseText} />
                                            </View>
                                        )}

                                        {item && (
                                            <>
                                                {index > 0 && (
                                                    <Pressable onPress={() => moveImageUp(index)} style={[styles.slotButton, styles.slotTopButton]} disabled={busy}>
                                                        <ArrowUp size={scale(15)} color={colors.chrome.common.inverseText} />
                                                    </Pressable>
                                                )}
                                                <View style={styles.slotActions}>
                                                    <Pressable onPress={() => pickImage(index)} style={styles.slotButton} disabled={busy}>
                                                        <Pencil size={scale(15)} color={colors.chrome.common.inverseText} />
                                                    </Pressable>
                                                    <Pressable onPress={() => removeImage(item.uuid)} style={[styles.slotButton, styles.dangerButton]} disabled={busy}>
                                                        <Trash2 size={scale(15)} color={colors.chrome.common.inverseText} />
                                                    </Pressable>
                                                </View>
                                            </>
                                        )}
                                    </Pressable>
                                );
                            })}
                        </View>
                    )}

                    {message && (
                        <Text
                            variant="body-sm"
                            style={{
                                marginTop: scale(10),
                                color: message.type === 'success' ? colors.chrome.common.successStrong : colors.brand.accent.error,
                            }}
                        >
                            {message.text}
                        </Text>
                    )}

                    {(canUsePrivateGallery || privacy === 'private') && (
                        <View style={[styles.privacyRow, { borderColor, backgroundColor: inputBackground }]}>
                            <View style={[styles.privacyIcon, { backgroundColor: colors.brand.bg.surface }]}>
                                {privacy === 'private' ? (
                                    <Lock size={scale(16)} color={iconColor} />
                                ) : (
                                    <Unlock size={scale(16)} color={iconColor} />
                                )}
                            </View>
                            <View style={styles.privacyContent}>
                                <View style={styles.privacyTitleRow}>
                                    <Text variant="body" className="font-body-semi" style={styles.privacyTitle}>
                                        {t('gallery_privacy_title')}
                                    </Text>
                                    <Pressable
                                        onPress={togglePrivacy}
                                        disabled={updatingPrivacy}
                                        accessibilityRole="switch"
                                        accessibilityState={{ checked: privacy === 'private', disabled: updatingPrivacy }}
                                        style={[
                                            styles.privacySwitch,
                                            {
                                                backgroundColor: privacy === 'private'
                                                    ? colors.chrome.primary
                                                    : colors.brand.bg.border,
                                                opacity: updatingPrivacy ? 0.72 : 1,
                                            },
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.privacySwitchThumb,
                                                privacy === 'private' && styles.privacySwitchThumbOn,
                                            ]}
                                        >
                                            {updatingPrivacy ? <ActivityIndicator size="small" color={colors.chrome.primary} /> : null}
                                        </View>
                                    </Pressable>
                                </View>
                                <Text variant="caption" style={{ color: colors.brand.text.subtitle }}>
                                    {t('gallery_privacy_note')}
                                </Text>
                            </View>
                        </View>
                    )}

                    <FieldLabel text={t('profile_headline')} />
                    <TextInput
                        value={headline}
                        onChangeText={(value) => {
                            setHeadline(trimToNonSpaceLimit(value, HEADLINE_MAX));
                            if (errors.headline) setErrors((current) => ({ ...current, headline: '' }));
                        }}
                        placeholder={t('profile_headline_ph')}
                        placeholderTextColor={colors.brand.text.muted}
                        maxLength={140}
                        style={[
                            styles.input,
                            {
                                color: colors.brand.text.body,
                                backgroundColor: inputBackground,
                                borderColor: errors.headline ? colors.brand.accent.error : borderColor,
                                fontFamily: inputFontFamily,
                            },
                        ]}
                    />
                    {errors.headline && <ErrorText text={errors.headline} />}
                    <Text variant="caption" style={{ color: colors.brand.text.subtitle }}>
                        {countNonSpace(headline)}/{HEADLINE_MAX}
                    </Text>

                    <FieldLabel text={t('bio')} />
                    <TextInput
                        value={bio}
                        onChangeText={(value) => {
                            setBio(trimToNonSpaceLimit(normalizeProfileText(value), BIO_MAX));
                            if (errors.bio) setErrors((current) => ({ ...current, bio: '' }));
                        }}
                        placeholder={t('bio_ph')}
                        placeholderTextColor={colors.brand.text.muted}
                        multiline
                        textAlignVertical="top"
                        maxLength={900}
                        style={[
                            styles.textArea,
                            {
                                color: colors.brand.text.body,
                                backgroundColor: inputBackground,
                                borderColor: errors.bio ? colors.brand.accent.error : borderColor,
                                fontFamily: inputFontFamily,
                            },
                        ]}
                    />
                    {errors.bio && <ErrorText text={errors.bio} />}
                    <Text variant="caption" style={{ color: colors.brand.text.subtitle }}>
                        {countNonSpace(bio)}/{BIO_MAX}
                    </Text>
                </ScrollView>
            </KeyboardAvoidingView>

            <View style={styles.footer}>
                <GradientButton
                    title={translated(t, 'finish', 'Finish')}
                    onPress={handleSubmit}
                    loading={submitting}
                    disabled={submitting || uploadingSlot !== null || updatingPrivacy}
                />
            </View>

            <GalleryCropModal
                visible={Boolean(cropDraft)}
                imageUri={cropDraft?.uri || ''}
                sourceSize={cropDraft?.width && cropDraft?.height ? { width: cropDraft.width, height: cropDraft.height } : undefined}
                isDark={isDark}
                uploading={uploadingSlot !== null}
                errorMessage={cropError}
                labels={{
                    title: translated(t, 'adjust_photo', 'Adjust photo'),
                    subtitle: translated(t, 'crop_photo_helper', 'Drag the photo to frame it. We will save it in a 3:4 portrait ratio.'),
                    preparing: translated(t, 'preparing_photo', 'Preparing photo...'),
                    upload: translated(t, 'choose', 'Choose'),
                    rotate: translated(t, 'rotate_photo', 'Rotate photo'),
                }}
                onClose={() => {
                    if (uploadingSlot === null) {
                        setCropDraft(null);
                        setCropError(null);
                    }
                }}
                onUpload={uploadCroppedImage}
                onError={(messageKey) => {
                    const text = messageKey ? translateApiError(messageKey) : t('img_validation_failed');
                    setCropError(text);
                    setMessage({ type: 'error', text });
                }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    loadingBox: {
        height: scale(160),
        alignItems: 'center',
        justifyContent: 'center',
    },
    galleryGrid: {
        flexDirection: 'row',
        gap: scale(10),
    },
    slot: {
        flex: 1,
        aspectRatio: 3 / 4,
        borderWidth: 1,
        borderRadius: scale(12),
        overflow: 'hidden',
    },
    emptySlot: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: scale(8),
        gap: scale(8),
    },
    busyOverlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(15,23,42,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    slotActions: {
        position: 'absolute',
        left: scale(6),
        right: scale(6),
        bottom: scale(6),
        flexDirection: 'row',
        justifyContent: 'center',
        gap: scale(6),
    },
    slotButton: {
        width: scale(28),
        height: scale(28),
        borderRadius: scale(14),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15,23,42,0.78)',
    },
    slotTopButton: {
        position: 'absolute',
        top: scale(6),
        right: scale(6),
    },
    dangerButton: {
        backgroundColor: 'rgba(225,29,72,0.85)',
    },
    privacyRow: {
        marginTop: scale(18),
        borderWidth: 1,
        borderRadius: scale(14),
        padding: scale(14),
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: scale(12),
    },
    privacyIcon: {
        width: scale(34),
        height: scale(34),
        borderRadius: scale(11),
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: scale(1),
    },
    privacyContent: {
        flex: 1,
        gap: scale(6),
    },
    privacyTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(10),
    },
    privacyTitle: {
        flex: 1,
    },
    privacySwitch: {
        width: scale(52),
        height: scale(30),
        borderRadius: scale(15),
        padding: scale(3),
        justifyContent: 'center',
    },
    privacySwitchThumb: {
        width: scale(24),
        height: scale(24),
        borderRadius: scale(12),
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0F172A',
        shadowOpacity: 0.16,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    privacySwitchThumbOn: {
        transform: [{ translateX: scale(22) }],
    },
    input: {
        minHeight: scale(50),
        borderWidth: 1,
        borderRadius: scale(12),
        paddingHorizontal: scale(14),
        fontSize: scale(14),
    },
    textArea: {
        minHeight: scale(132),
        borderWidth: 1,
        borderRadius: scale(12),
        paddingHorizontal: scale(14),
        paddingVertical: scale(12),
        fontSize: scale(14),
    },
    footer: {
        padding: scale(20),
        paddingBottom: scale(10),
    },
});
