import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ImagePlus, Info, Lock, Star, Unlock } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { CompletionImpactBadge } from '@/components/profile/CompletionImpactBadge';
import { SingleSelectSheet } from '@/components/ui/SingleSelectSheet';
import { GalleryCropModal } from '@/components/app/GalleryCropModal';
import { MediaGuidelinesModal } from '@/components/app/MediaGuidelinesModal';
import { galleryService, GalleryItem, GalleryPrivacy, GalleryResponse } from '@/lib/galleryService';
import { hasQualifiedGalleryImage, isQualifiedGalleryImage } from '@/lib/galleryQualification';
import { apiMessage, t } from '@/lib/profileDisplay';
import { useTheme } from '@/hooks/useTheme';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/useToast';
import { isGalleryModerationActive } from '@/hooks/useGalleryModeration';
import { scale } from '@/hooks/useResponsive';
import { CURRENT_USER_STATUS_QUERY_KEY } from '@/hooks/useCurrentUserStatus';
import { queryKeys } from '@/lib/queryKeys';
import { Typography } from '@/constants/typography';
import { localeUsesLatinScript } from '@/lib/textDirection';

const GALLERY_MAX_SLOTS = 3;
const GALLERY_SOURCE_MAX_BYTES = 15 * 1024 * 1024;

type CropDraft = {
    uri: string;
    slotIndex: number;
    width?: number;
    height?: number;
};

type Props = {
    canUsePrivateGallery: boolean;
    initialGallery?: GalleryItem[];
    initialPrivacy?: GalleryPrivacy;
    variant?: 'edit-profile' | 'onboarding';
    gender?: 'male' | 'female';
    guidelinesIdentity?: string;
    autoShowGuidelines?: boolean;
    requiredError?: string;
    completionImpact?: number;
    onGalleryChange?: (payload: { gallery: GalleryItem[]; privacy: GalleryPrivacy; avatarUuid?: string | null }) => void;
    onBusyChange?: (busy: boolean) => void;
};

function imageUrl(item?: GalleryItem | null) {
    return item?.urls?.small || item?.urls?.thumb || item?.urls?.avatar || item?.urls?.original || item?.url || '';
}

function normalizeGallery(items: GalleryItem[] = []) {
    return [...items].sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;
        return Number(a.sort_index ?? 0) - Number(b.sort_index ?? 0);
    });
}

export function ProfileMediaEditor({
    canUsePrivateGallery,
    initialGallery = [],
    initialPrivacy = 'public',
    variant = 'edit-profile',
    gender = canUsePrivateGallery ? 'female' : 'male',
    guidelinesIdentity = 'current-user',
    autoShowGuidelines = true,
    requiredError,
    completionImpact = 0,
    onGalleryChange,
    onBusyChange,
}: Props) {
    const { isDark } = useTheme();
    const colors = useColors();
    const { currentLanguage, isRTL } = useLanguage();
    const usesLatinLabels = localeUsesLatinScript(currentLanguage);
    const { show: showToast } = useToast();
    const queryClient = useQueryClient();
    const [privacy, setPrivacy] = useState<GalleryPrivacy>(canUsePrivateGallery ? initialPrivacy : 'public');
    const [gallery, setGallery] = useState<GalleryItem[]>(() => normalizeGallery(initialGallery));
    const [loading, setLoading] = useState(true);
    const [busySlot, setBusySlot] = useState<number | null>(null);
    const [deletingUuid, setDeletingUuid] = useState<string | null>(null);
    const [primaryUuid, setPrimaryUuid] = useState<string | null>(null);
    const [privacyBusy, setPrivacyBusy] = useState(false);
    const [cropDraft, setCropDraft] = useState<CropDraft | null>(null);
    const [cropError, setCropError] = useState<string | null>(null);
    const [sourceSlot, setSourceSlot] = useState<number | null>(null);
    const [guidelinesVisible, setGuidelinesVisible] = useState(false);
    const onGalleryChangeRef = useRef(onGalleryChange);
    const { data: sharedGalleryResponse } = useQuery<GalleryResponse>({
        queryKey: queryKeys.gallery.me,
        queryFn: galleryService.fetchMe,
        enabled: false,
    });

    const slots = useMemo(
        () => Array.from({ length: GALLERY_MAX_SLOTS }, (_, index) => gallery[index] ?? null),
        [gallery]
    );
    const hasApprovedGalleryImage = hasQualifiedGalleryImage(gallery);

    const borderColor = colors.brand.bg.border;
    const surface = colors.chrome.common.card;
    const mutedSurface = colors.brand.bg.surface;
    const mutedText = colors.brand.text.subtitle;
    const emptySlotBorder = isDark ? colors.brand.text.subtitle : '#8F877D';
    const busy =
        loading ||
        busySlot !== null ||
        deletingUuid !== null ||
        primaryUuid !== null ||
        privacyBusy;
    const guidelinesStorageKey = useMemo(
        () => `tonikah:media-guidelines:v1:${guidelinesIdentity}:${gender}`,
        [gender, guidelinesIdentity],
    );

    useEffect(() => {
        onBusyChange?.(busy);
    }, [busy, onBusyChange]);

    useEffect(() => {
        onGalleryChangeRef.current = onGalleryChange;
    }, [onGalleryChange]);

    useEffect(() => {
        if (!autoShowGuidelines) return;
        let active = true;
        void AsyncStorage.getItem(guidelinesStorageKey)
            .then((seen) => {
                if (active && seen !== '1') setGuidelinesVisible(true);
            })
            .catch(() => {
                if (active) setGuidelinesVisible(true);
            });
        return () => {
            active = false;
        };
    }, [autoShowGuidelines, guidelinesStorageKey]);

    const acknowledgeGuidelines = useCallback(() => {
        setGuidelinesVisible(false);
        void AsyncStorage.setItem(guidelinesStorageKey, '1').catch(() => undefined);
    }, [guidelinesStorageKey]);

    const applyGalleryResponse = useCallback((res: GalleryResponse) => {
        if (res.success) {
            const nextGallery = normalizeGallery(res.gallery || []);
            // Male accounts and galleries without an approved photo are always public.
            const nextPrivacy: GalleryPrivacy =
                canUsePrivateGallery && hasQualifiedGalleryImage(nextGallery) && res.privacy === 'private'
                    ? 'private'
                    : 'public';
            setPrivacy(nextPrivacy);
            setGallery(nextGallery);
            onGalleryChangeRef.current?.({
                gallery: nextGallery,
                privacy: nextPrivacy,
                avatarUuid: res.avatarUuid,
            });
            void queryClient.invalidateQueries({
                queryKey: CURRENT_USER_STATUS_QUERY_KEY,
            });
        }
    }, [canUsePrivateGallery, queryClient]);

    const refreshGallery = useCallback(async (showLoader = false, silent = false) => {
        if (showLoader) setLoading(true);
        const res = await galleryService.fetchMe();
        if (res.success) {
            queryClient.setQueryData(queryKeys.gallery.me, res);
            applyGalleryResponse(res);
        } else if (!silent) {
            showToast(apiMessage(res.message), 'error');
        }
        if (showLoader) setLoading(false);
        return res;
    }, [applyGalleryResponse, queryClient, showToast]);

    useEffect(() => {
        if (sharedGalleryResponse?.success) applyGalleryResponse(sharedGalleryResponse);
    }, [applyGalleryResponse, sharedGalleryResponse]);

    useEffect(() => {
        void refreshGallery(true);
    }, [refreshGallery]);

    const pickImage = (slotIndex: number) => {
        if (gallery.length >= GALLERY_MAX_SLOTS && !gallery[slotIndex]) {
            showToast(t('gallery_limit_reached', 'Gallery limit reached.'), 'warning', 2500);
            return;
        }
        setCropError(null);
        setSourceSlot(slotIndex);
    };

    const startCrop = (slotIndex: number, asset: ImagePicker.ImagePickerAsset) => {
        if (asset.fileSize && asset.fileSize > GALLERY_SOURCE_MAX_BYTES) {
            showToast(t('max_15mb_each', 'Image must not exceed 15MB'), 'error');
            return;
        }
        setCropDraft({ uri: asset.uri, slotIndex, width: asset.width, height: asset.height });
    };

    const pickFromGallery = async (slotIndex: number) => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted') {
            showToast(t('photo_permission_required', 'Photo library permission is required.'), 'error');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 1,
            allowsMultipleSelection: false,
        });
        if (result.canceled || !result.assets?.[0]?.uri) return;
        startCrop(slotIndex, result.assets[0]);
    };

    const captureWithCamera = async (slotIndex: number) => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (permission.status !== 'granted') {
            showToast(t('camera_permission_required', 'Camera permission is required.'), 'error');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 1,
        });
        if (result.canceled || !result.assets?.[0]?.uri) return;
        startCrop(slotIndex, result.assets[0]);
    };

    const uploadCroppedImage = async (uri: string) => {
        if (!cropDraft) return;
        const slotIndex = cropDraft.slotIndex;
        setBusySlot(slotIndex);
        setCropError(null);
        try {
            const replaceUuid = gallery[slotIndex]?.uuid;

            const formData = new FormData();
            formData.append('image', {
                uri,
                name: 'gallery.jpg',
                type: 'image/jpeg',
            } as any);
            formData.append('clientLocale', currentLanguage);
            if (replaceUuid) formData.append('replaceUuid', replaceUuid);

            const uploadRes = await galleryService.upload(formData);
            if (!uploadRes.success || !uploadRes.image?.uuid) {
                throw new Error(uploadRes.message || 'upload_failed');
            }

            const galleryRes = await refreshGallery(false);
            if (!galleryRes.success || !galleryRes.gallery?.some((item) => item.uuid === uploadRes.image?.uuid)) {
                throw new Error('gallery_upload_error');
            }

            setCropDraft(null);
            showToast(
                uploadRes.pendingReview
                    ? t('image_moderation_submitted_review', 'Photo submitted for review.')
                    : t('gallery_photo_uploaded_success', 'Photo uploaded successfully.'),
                'success',
                2500,
            );
        } catch (error: any) {
            const message = t(error?.message || 'gallery_upload_error', 'Could not upload photo.');
            setCropError(message);
            showToast(message, 'error');
        } finally {
            setBusySlot(null);
        }
    };

    const removeImage = async (uuid: string) => {
        setDeletingUuid(uuid);
        try {
            const res = await galleryService.remove(uuid);
            if (res.success) {
                // Deleting the last image flips privacy to public server-side; apply
                // the DELETE response immediately, then refetch as source of truth.
                if (res.privacy) {
                    setPrivacy(canUsePrivateGallery && gallery.length > 1 && res.privacy === 'private' ? 'private' : 'public');
                }
                await refreshGallery(false);
                showToast(t('gallery_photo_deleted_success', 'Photo removed successfully.'), 'success', 2500);
            } else {
                showToast(apiMessage(res.message), 'error');
            }
        } catch {
            showToast(t('something_went_wrong', 'Something went wrong.'), 'error');
        } finally {
            setDeletingUuid(null);
        }
    };

    const makePrimary = async (uuid: string) => {
        if (primaryUuid) return;
        setPrimaryUuid(uuid);
        try {
            const res = await galleryService.makePrimary(uuid);
            if (res.success) {
                await refreshGallery(false);
                showToast(t('profile_updated_success', 'Profile updated successfully.'), 'success', 2500);
            } else {
                showToast(apiMessage(res.message), 'error');
            }
        } catch {
            showToast(t('something_went_wrong', 'Something went wrong.'), 'error');
        } finally {
            setPrimaryUuid(null);
        }
    };

    const togglePrivacy = async () => {
        if (privacyBusy) return;
        const next = privacy === 'private' ? 'public' : 'private';
        if (next === 'private') {
            if (!canUsePrivateGallery) return;
            if (!hasApprovedGalleryImage) {
                showToast(
                    t(
                        'private_gallery_requires_image',
                        'Add and receive approval for at least one photo before making your gallery private.',
                    ),
                    'info',
                );
                return;
            }
        }
        const previous = privacy;
        setPrivacy(next);
        setPrivacyBusy(true);
        try {
            const res = await galleryService.updatePrivacy(next);
            if (res.success) {
                showToast(
                    t('privacy_updated_to', 'Privacy updated.', { pkey: t(`privacy_${next}`, next) }),
                    'success',
                    2500,
                    { icon: next === 'private' ? 'lock' : 'unlock' },
                );
                await refreshGallery(false);
            } else {
                setPrivacy(previous);
                const errorKey = res.message === 'private_gallery_requires_image'
                    ? 'private_gallery_requires_image'
                    : res.message || 'privacy_error';
                showToast(apiMessage(errorKey), 'error');
            }
        } catch {
            setPrivacy(previous);
            showToast(t('privacy_error', 'Could not update privacy.'), 'error');
        } finally {
            setPrivacyBusy(false);
        }
    };

    const warningColors = colors.chrome.toast.warning;

    return (
        <View
            style={[
                styles.section,
                variant === 'onboarding' && styles.onboardingSection,
                {
                    borderColor: variant === 'onboarding' ? 'transparent' : borderColor,
                    backgroundColor: variant === 'onboarding' ? 'transparent' : colors.brand.bg.surface,
                },
            ]}
        >
            <View style={styles.sectionHeader}>
                <View style={styles.titleGroup}>
                    <Text variant="body" className="font-body-bold" style={styles.sectionTitle}>
                        {variant === 'onboarding'
                            ? t('upload_images_to_profile', 'Upload images to your profile')
                            : t('photo_gallery', 'Photo gallery')}
                    </Text>
                    {variant === 'edit-profile' && completionImpact > 0 ? (
                        <CompletionImpactBadge value={completionImpact} />
                    ) : null}
                </View>
                <View style={styles.headerActions}>
                    <Text variant="caption" style={{ color: mutedText }}>
                        {gallery.length}/{GALLERY_MAX_SLOTS}
                    </Text>
                    <Pressable
                        onPress={() => setGuidelinesVisible(true)}
                        accessibilityRole="button"
                        accessibilityLabel={t('media_guidelines_reopen', 'View photo guidelines')}
                        hitSlop={8}
                        style={styles.infoButton}
                    >
                        <Info size={scale(19)} color={mutedText} />
                    </Pressable>
                </View>
            </View>

            {loading ? (
                <View style={styles.loading}>
                    <ActivityIndicator color={colors.chrome.primary} />
                </View>
            ) : (
                <View style={styles.grid}>
                    {slots.map((item, index) => {
                        const src = imageUrl(item);
                        const uuid = item?.uuid;
                        const itemStatus = item?.moderationMeta?.status;
                        const checking = isGalleryModerationActive(itemStatus);
                        const underReview = Boolean(item && item.safe === false && !checking);
                        const deleting = deletingUuid === uuid;
                        const busy =
                            busySlot === index ||
                            deleting ||
                            primaryUuid === uuid;
                        const primary = Boolean(item && isQualifiedGalleryImage(item) && item.isPrimary);
                        return (
                            <Pressable
                                key={uuid || `slot-${index}`}
                                onPress={() => pickImage(index)}
                                disabled={busy}
                                style={[
                                    styles.slot,
                                    item ? styles.filledSlot : styles.emptySlotFrame,
                                    {
                                        borderColor: item ? borderColor : emptySlotBorder,
                                        backgroundColor: mutedSurface,
                                    },
                                ]}
                            >
                                {src ? (
                                    <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" />
                                ) : (
                                    <View style={styles.emptySlot}>
                                        <ImagePlus size={scale(24)} color={mutedText} />
                                        <Text variant="caption" style={{ color: mutedText, textAlign: 'center' }}>
                                            {t('add_photo_number', 'Add photo {{number}}', { number: index + 1 })}
                                        </Text>
                                    </View>
                                )}

                                {primary && item ? (
                                    <View
                                        style={styles.primaryBadge}
                                        accessible
                                        accessibilityLabel={t('primary', 'Primary')}
                                    >
                                        <Star size={scale(13)} color={colors.chrome.common.inverseText} fill={colors.chrome.common.inverseText} />
                                    </View>
                                ) : null}

                                {busy ? (
                                    <View style={styles.busyOverlay}>
                                        <ActivityIndicator color={colors.chrome.common.inverseText} />
                                    </View>
                                ) : null}

                                {item && !busy && (checking || underReview) ? (
                                    <Pressable
                                        onPress={(event) => {
                                            event.stopPropagation();
                                            const title = checking
                                                ? t('image_moderation_checking', 'Checking photo')
                                                : t('moderation_text_under_review', 'Under review');
                                            const hint = checking
                                                ? t(
                                                    'image_moderation_checking_hint',
                                                    'Automatic safety check in progress. You can continue using the app.',
                                                )
                                                : t(
                                                    'image_moderation_pending_hint',
                                                    'This photo is waiting for review and is hidden from other members.',
                                                );
                                            showToast(`${title}\n${hint}`, 'warning', 5000);
                                        }}
                                        accessibilityRole="button"
                                        hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                                        accessibilityLabel={checking
                                            ? t('image_moderation_checking', 'Checking photo')
                                            : t('moderation_text_under_review', 'Under review')}
                                        accessibilityHint={checking
                                            ? t(
                                                'image_moderation_checking_hint',
                                                'Automatic safety check in progress. You can continue using the app.',
                                            )
                                            : t(
                                                'image_moderation_pending_hint',
                                                'This photo is waiting for review and is hidden from other members.',
                                            )}
                                        style={[
                                            styles.moderationBadge,
                                            { backgroundColor: warningColors.bg },
                                        ]}
                                    >
                                        {checking ? (
                                            <ActivityIndicator
                                                size="small"
                                                color={warningColors.icon}
                                                style={styles.badgeSpinner}
                                            />
                                        ) : (
                                            <AlertCircle
                                                size={scale(12)}
                                                color={warningColors.icon}
                                                strokeWidth={2.5}
                                            />
                                        )}
                                        <Text
                                            style={[styles.moderationBadgeText, { color: warningColors.text }]}
                                            numberOfLines={1}
                                        >
                                            {checking
                                                ? t('image_moderation_checking', 'Checking photo')
                                                : t('moderation_text_under_review', 'Under review')}
                                        </Text>
                                    </Pressable>
                                ) : null}

                            </Pressable>
                        );
                    })}
                </View>
            )}

            {requiredError ? (
                <Text variant="caption" style={{ color: colors.brand.accent.error }}>
                    {requiredError}
                </Text>
            ) : null}

            {canUsePrivateGallery ? (
                <View
                    style={variant === 'edit-profile'
                        ? [
                            styles.privacySection,
                            {
                                borderColor,
                                backgroundColor: privacy === 'private'
                                    ? colors.brand.bg.surface
                                    : warningColors.bg,
                            },
                        ]
                        : undefined}
                >
                    {variant === 'edit-profile' ? (
                        <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.86}
                            style={[
                                styles.privacySectionTitle,
                                {
                                    color: privacy === 'private'
                                        ? colors.chrome.common.textStrong
                                        : warningColors.text,
                                },
                            ]}
                        >
                            {t('gallery_privacy_section', 'Gallery privacy')}
                        </Text>
                    ) : null}
                    <View
                        style={variant === 'edit-profile'
                            ? styles.privacyFieldRow
                            : [styles.privacyRow, { borderColor, backgroundColor: mutedSurface }]}
                    >
                    <View
                        style={[
                            variant === 'edit-profile' ? styles.privacyFieldIcon : styles.privacyIcon,
                            {
                                backgroundColor: variant === 'edit-profile'
                                    ? privacy === 'private'
                                        ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(16,16,17,0.06)')
                                        : (isDark ? 'rgba(242,184,75,0.16)' : 'rgba(245,158,11,0.14)')
                                    : surface,
                            },
                        ]}
                    >
                        {privacy === 'private' ? (
                            <Lock
                                size={scale(18)}
                                color={colors.brand.text.subtitle}
                            />
                        ) : (
                            <Unlock
                                size={scale(18)}
                                color={variant === 'edit-profile' ? warningColors.icon : colors.brand.text.subtitle}
                            />
                        )}
                    </View>
                    <View style={styles.privacyContent}>
                        <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.86}
                            style={[
                                styles.privacyFieldLabel,
                                usesLatinLabels ? styles.latinFieldLabel : styles.naturalFieldLabel,
                                {
                                    color: variant === 'edit-profile' && privacy !== 'private'
                                        ? warningColors.text
                                        : colors.chrome.common.textMuted,
                                },
                            ]}
                        >
                            {t('gallery_privacy_title', 'Keep my photos private')}
                        </Text>
                        <Text
                            style={[
                                styles.privacyFieldValue,
                                {
                                    color: variant === 'edit-profile' && privacy !== 'private'
                                        ? warningColors.text
                                        : mutedText,
                                },
                            ]}
                        >
                            {hasApprovedGalleryImage
                                ? t('gallery_privacy_note', 'Your images will remain blurred for all members unless you approve visibility.')
                                : t(
                                    'private_gallery_requires_image',
                                    'Add and receive approval for at least one photo before making your gallery private.',
                                )}
                        </Text>
                    </View>
                    <Pressable
                        onPress={togglePrivacy}
                        disabled={privacyBusy}
                        accessibilityRole="switch"
                        accessibilityState={{
                            checked: privacy === 'private',
                            disabled: privacyBusy,
                            busy: privacyBusy,
                        }}
                        style={[
                            styles.switchTrack,
                            {
                                backgroundColor: privacy === 'private'
                                    ? colors.chrome.primary
                                    : variant === 'edit-profile'
                                        ? '#FFFFFF'
                                        : colors.brand.bg.border,
                                borderColor: privacy !== 'private' && variant === 'edit-profile'
                                    ? warningColors.border
                                    : 'transparent',
                                borderWidth: privacy !== 'private' && variant === 'edit-profile' ? 1 : 0,
                                opacity: privacy !== 'private' && !hasApprovedGalleryImage ? 0.55 : 1,
                            },
                        ]}
                    >
                        {privacyBusy ? (
                            <View
                                style={[
                                    styles.switchThumb,
                                    styles.switchLoaderThumb,
                                    privacy === 'private' && styles.switchThumbOn,
                                    {
                                        borderColor: privacy !== 'private' && variant === 'edit-profile'
                                            ? warningColors.border
                                            : 'transparent',
                                        borderWidth: privacy !== 'private' && variant === 'edit-profile' ? 1 : 0,
                                    },
                                ]}
                            >
                                <ActivityIndicator
                                    size="small"
                                    color={privacy === 'private'
                                        ? colors.chrome.primary
                                        : warningColors.icon}
                                />
                            </View>
                        ) : (
                            <View
                                style={[
                                    styles.switchThumb,
                                    privacy === 'private' && styles.switchThumbOn,
                                    {
                                        backgroundColor: colors.chrome.common.inverseText,
                                        borderColor: privacy !== 'private' && variant === 'edit-profile'
                                            ? warningColors.border
                                            : 'transparent',
                                        borderWidth: privacy !== 'private' && variant === 'edit-profile' ? 1 : 0,
                                    },
                                ]}
                            />
                        )}
                    </Pressable>
                    </View>
                </View>
            ) : null}

            <SingleSelectSheet
                visible={sourceSlot !== null}
                onClose={() => setSourceSlot(null)}
                onSelect={(source) => {
                    const slot = sourceSlot;
                    const selectedItem = slot === null ? null : gallery[slot];
                    setSourceSlot(null);
                    if (slot === null) return;
                    if (source === 'primary') {
                        if (selectedItem?.uuid) void makePrimary(selectedItem.uuid);
                        return;
                    }
                    if (source === 'delete') {
                        if (selectedItem?.uuid) void removeImage(selectedItem.uuid);
                        return;
                    }
                    // Let the sheet dismiss before presenting the system picker
                    // or camera; simultaneous presentation fails on iOS.
                    setTimeout(() => {
                        if (source === 'camera') void captureWithCamera(slot);
                        else void pickFromGallery(slot);
                    }, 400);
                }}
                options={[
                    { value: 'camera', label: t('take_photo', 'Take a photo') },
                    { value: 'gallery', label: t('choose_from_gallery', 'Choose from gallery') },
                    ...(sourceSlot !== null && gallery[sourceSlot]
                        && !gallery[sourceSlot]?.isPrimary
                        && sourceSlot !== 0
                        && isQualifiedGalleryImage(gallery[sourceSlot])
                        ? [{ value: 'primary', label: t('make_primary', 'Make primary') }]
                        : []),
                    ...(sourceSlot !== null && gallery[sourceSlot]
                        ? [{ value: 'delete', label: t('delete_photo', 'Delete photo'), destructive: true }]
                        : []),
                ]}
                title={sourceSlot !== null && gallery[sourceSlot]
                    ? t('photo_options', 'Photo options')
                    : t('add_photo', 'Add photo')}
                optionMode="action"
            />

            <GalleryCropModal
                visible={Boolean(cropDraft)}
                imageUri={cropDraft?.uri || ''}
                sourceSize={cropDraft?.width && cropDraft?.height ? { width: cropDraft.width, height: cropDraft.height } : undefined}
                isDark={isDark}
                onClose={() => setCropDraft(null)}
                uploading={busySlot !== null}
                errorMessage={cropError}
                labels={{
                    title: t('adjust_photo', 'Adjust photo'),
                    subtitle: t('crop_photo_helper', 'Drag the photo to frame it. We will save it in a 3:4 portrait ratio.'),
                    preparing: t('preparing_photo', 'Preparing photo...'),
                    upload: t('choose', 'Choose'),
                    rotate: t('rotate', 'Rotate'),
                }}
                onUpload={uploadCroppedImage}
                onError={(message) => {
                    const errorMessage = t(message || 'gallery_upload_error', 'Could not prepare photo.');
                    setCropError(errorMessage);
                    showToast(errorMessage, 'error');
                }}
            />

            <MediaGuidelinesModal
                visible={guidelinesVisible}
                gender={gender}
                canUsePrivateGallery={canUsePrivateGallery}
                onAcknowledge={acknowledgeGuidelines}
            />
        </View>
    );
}

export const EditProfileMediaEditor = ProfileMediaEditor;

const styles = StyleSheet.create({
    section: {
        borderTopWidth: 1,
        borderRadius: 0,
        paddingHorizontal: scale(16),
        paddingVertical: scale(20),
        gap: scale(12),
    },
    onboardingSection: {
        borderWidth: 0,
        borderRadius: 0,
        padding: 0,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    titleGroup: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(8),
    },
    sectionTitle: {
        fontSize: scale(16),
        lineHeight: scale(21),
        flexShrink: 1,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(10),
    },
    infoButton: {
        width: scale(30),
        height: scale(30),
        alignItems: 'center',
        justifyContent: 'center',
    },
    loading: {
        minHeight: scale(120),
        alignItems: 'center',
        justifyContent: 'center',
    },
    grid: {
        flexDirection: 'row',
        gap: scale(10),
    },
    slot: {
        flex: 1,
        aspectRatio: 3 / 4,
        borderRadius: scale(12),
        overflow: 'hidden',
    },
    filledSlot: {
        borderWidth: 1,
    },
    emptySlotFrame: {
        borderWidth: 2,
        borderStyle: 'dashed',
    },
    emptySlot: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(8),
        padding: scale(8),
    },
    primaryBadge: {
        position: 'absolute',
        top: scale(8),
        left: scale(8),
        width: scale(28),
        height: scale(28),
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: scale(14),
        backgroundColor: 'rgba(16, 16, 17,0.72)',
    },
    busyOverlay: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(16, 16, 17,0.48)',
    },
    moderationBadge: {
        position: 'absolute',
        left: scale(8),
        bottom: scale(8),
        height: scale(24),
        borderRadius: scale(999),
        paddingHorizontal: scale(8),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(4),
        maxWidth: '88%',
    },
    moderationBadgeText: {
        flexShrink: 1,
        fontSize: scale(11),
        lineHeight: scale(14),
        fontWeight: '700',
        includeFontPadding: false,
    },
    badgeSpinner: {
        transform: [{ scale: 0.62 }],
        marginHorizontal: -scale(3),
    },
    privacyRow: {
        minHeight: scale(84),
        borderWidth: 1,
        borderRadius: scale(12),
        paddingHorizontal: scale(12),
        paddingVertical: scale(12),
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(12),
    },
    privacySection: {
        borderTopWidth: 1,
        marginHorizontal: scale(-16),
        marginBottom: scale(-20),
        marginTop: scale(10),
        paddingTop: scale(22),
    },
    privacySectionTitle: {
        paddingHorizontal: scale(16),
        marginBottom: scale(2),
        fontSize: scale(16),
        lineHeight: scale(21),
        fontFamily: Typography.font.body.semi,
        fontWeight: '600',
    },
    privacyFieldRow: {
        minHeight: scale(85),
        paddingHorizontal: scale(16),
        paddingVertical: scale(22),
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(12),
    },
    privacyContent: {
        flex: 1,
        minWidth: 0,
        gap: scale(3),
    },
    privacyFieldLabel: {
        flexShrink: 1,
        fontSize: scale(13),
        lineHeight: scale(17),
        fontFamily: Typography.font.body.bold,
        fontWeight: '700',
    },
    latinFieldLabel: {
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
    naturalFieldLabel: {
        letterSpacing: 0,
        textTransform: 'none',
    },
    privacyFieldValue: {
        fontSize: scale(13),
        lineHeight: scale(18),
        fontFamily: Typography.font.body.regular,
        fontWeight: '400',
    },
    privacyFieldIcon: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(8),
        alignSelf: 'flex-start',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    privacyIcon: {
        width: scale(42),
        height: scale(42),
        borderRadius: scale(21),
        alignItems: 'center',
        justifyContent: 'center',
    },
    switchTrack: {
        width: scale(48),
        height: scale(28),
        borderRadius: scale(14),
        padding: scale(3),
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    switchLoaderThumb: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    switchThumb: {
        width: scale(22),
        height: scale(22),
        borderRadius: scale(11),
        backgroundColor: '#FFFFFF',
    },
    switchThumbOn: {
        transform: [{ translateX: scale(20) }],
    },
});
