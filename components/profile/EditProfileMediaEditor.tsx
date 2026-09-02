import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowUp, ImagePlus, Info, Lock, Star, Trash2, Unlock } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { SingleSelectSheet } from '@/components/ui/SingleSelectSheet';
import { GalleryCropModal } from '@/components/app/GalleryCropModal';
import { MediaGuidelinesModal } from '@/components/app/MediaGuidelinesModal';
import { galleryService, GalleryItem, GalleryPrivacy } from '@/lib/galleryService';
import { apiMessage, t } from '@/lib/profileDisplay';
import { useTheme } from '@/hooks/useTheme';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/useToast';
import { useChatSocket } from '@/hooks/useChatSocket';
import {
    isGalleryModerationActive,
    notifyGalleryModerationResult,
    useGalleryModerationEventGuard,
    useGalleryModerationNotifications,
    useGalleryModerationReconciliation,
} from '@/hooks/useGalleryModeration';
import { scale } from '@/hooks/useResponsive';
import { CURRENT_USER_STATUS_QUERY_KEY } from '@/hooks/useCurrentUserStatus';

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
    onGalleryChange,
    onBusyChange,
}: Props) {
    const { isDark } = useTheme();
    const colors = useColors();
    const { currentLanguage, isRTL } = useLanguage();
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
    const translate = useCallback((key: string, fallback?: string) => t(key, fallback), [currentLanguage]);

    const slots = useMemo(
        () => Array.from({ length: GALLERY_MAX_SLOTS }, (_, index) => gallery[index] ?? null),
        [gallery]
    );

    const borderColor = colors.brand.bg.border;
    const surface = colors.chrome.common.card;
    const mutedSurface = colors.brand.bg.surface;
    const mutedText = colors.brand.text.subtitle;
    const hasActiveModeration = gallery.some((item) =>
        isGalleryModerationActive(item.moderationMeta?.status),
    );
    const hasPendingReview = gallery.some(
        (item) => item.safe === false && !isGalleryModerationActive(item.moderationMeta?.status),
    );
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

    const refreshGallery = useCallback(async (showLoader = false, silent = false) => {
        if (showLoader) setLoading(true);
        const res = await galleryService.fetchMe();
        if (res.success) {
            const nextGallery = normalizeGallery(res.gallery || []);
            // Male accounts and empty galleries are always represented as public
            const nextPrivacy: GalleryPrivacy =
                canUsePrivateGallery && nextGallery.length > 0 && res.privacy === 'private' ? 'private' : 'public';
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
        } else if (!silent) {
            showToast(apiMessage(res.message), 'error');
        }
        if (showLoader) setLoading(false);
        return res;
    }, [canUsePrivateGallery, queryClient, showToast]);

    useEffect(() => {
        void refreshGallery(true);
    }, [refreshGallery]);

    const reconcileGallery = useCallback(
        () => refreshGallery(false, true),
        [refreshGallery],
    );
    const shouldProcessModerationEvent = useGalleryModerationEventGuard();
    useGalleryModerationReconciliation(reconcileGallery);
    useGalleryModerationNotifications(gallery, translate);

    useChatSocket({
        enabled: true,
        onGalleryModerationUpdated: (update) => {
            if (!shouldProcessModerationEvent(update)) return;
            if (update.deleted) {
                notifyGalleryModerationResult(update, translate);
            }
            void refreshGallery(false, true).catch(() => undefined);
        },
    });

    useEffect(() => {
        if (!hasActiveModeration) return;
        const interval = setInterval(() => {
            void refreshGallery(false, true).catch(() => undefined);
        }, 2500);
        return () => clearInterval(interval);
    }, [hasActiveModeration, refreshGallery]);

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
            // Local guard mirrors the API rule: a private gallery needs a photo
            if (gallery.length === 0) {
                showToast(t('private_gallery_requires_image', 'Upload at least one photo before making your gallery private.'), 'error');
                return;
            }
        }
        const previous = privacy;
        setPrivacy(next);
        setPrivacyBusy(true);
        try {
            const res = await galleryService.updatePrivacy(next);
            if (res.success) {
                showToast(t('privacy_updated_to', 'Privacy updated.', { pkey: t(`privacy_${next}`, next) }), 'success', 2500);
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
                    backgroundColor: variant === 'onboarding' ? 'transparent' : surface,
                },
            ]}
        >
            <View style={styles.sectionHeader}>
                <Text variant="body" className="font-body-bold" style={styles.sectionTitle}>
                    {variant === 'onboarding'
                        ? t('upload_images_to_profile', 'Upload images to your profile')
                        : t('photo_gallery', 'Photo gallery')}
                </Text>
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
                        const primary = Boolean(item?.isPrimary || index === 0);
                        return (
                            <Pressable
                                key={uuid || `slot-${index}`}
                                onPress={() => pickImage(index)}
                                disabled={busy}
                                style={[styles.slot, { borderColor, backgroundColor: mutedSurface }]}
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
                                    <View style={styles.primaryBadge}>
                                        <Star size={scale(11)} color={colors.chrome.common.inverseText} fill={colors.chrome.common.inverseText} />
                                        <Text style={styles.primaryText}>{t('primary', 'Primary')}</Text>
                                    </View>
                                ) : null}

                                {busySlot === index || primaryUuid === uuid ? (
                                    <View style={styles.busyOverlay}>
                                        <ActivityIndicator color={colors.chrome.common.inverseText} />
                                    </View>
                                ) : null}

                                {item && (checking || underReview) ? (
                                    <View
                                        style={[
                                            styles.moderationBadge,
                                            { backgroundColor: warningColors.border },
                                        ]}
                                    >
                                        {checking ? (
                                            <ActivityIndicator
                                                size="small"
                                                color={colors.chrome.common.inverseText}
                                                style={styles.badgeSpinner}
                                            />
                                        ) : (
                                            <AlertCircle
                                                size={scale(12)}
                                                color={colors.chrome.common.inverseText}
                                            />
                                        )}
                                        <Text style={styles.moderationBadgeText} numberOfLines={1}>
                                            {checking
                                                ? t('image_moderation_checking', 'Checking photo')
                                                : t('moderation_text_under_review', 'Under review')}
                                        </Text>
                                    </View>
                                ) : null}

                                {item ? (
                                    <View style={styles.slotActions}>
                                        {!primary && !checking && !underReview ? (
                                            <Pressable
                                                onPress={(event) => {
                                                    event.stopPropagation();
                                                    if (uuid) void makePrimary(uuid);
                                                }}
                                                disabled={busy}
                                                style={styles.slotAction}
                                                hitSlop={8}
                                                accessibilityRole="button"
                                                accessibilityLabel={t('make_primary', 'Make primary')}
                                            >
                                                <ArrowUp size={scale(15)} color={colors.chrome.common.inverseText} />
                                            </Pressable>
                                        ) : <View />}
                                        <Pressable
                                            onPress={(event) => {
                                                event.stopPropagation();
                                                if (uuid) void removeImage(uuid);
                                            }}
                                            disabled={busy}
                                            style={[styles.slotAction, styles.deleteAction]}
                                            hitSlop={8}
                                            accessibilityRole="button"
                                            accessibilityLabel={t('delete_photo', 'Delete photo')}
                                            accessibilityState={{ disabled: busy, busy: deleting }}
                                        >
                                            {deleting ? (
                                                <ActivityIndicator
                                                    size="small"
                                                    color={colors.chrome.common.inverseText}
                                                    style={styles.deleteSpinner}
                                                />
                                            ) : (
                                                <Trash2 size={scale(14)} color={colors.chrome.common.inverseText} />
                                            )}
                                        </Pressable>
                                    </View>
                                ) : null}
                            </Pressable>
                        );
                    })}
                </View>
            )}

            {hasActiveModeration || hasPendingReview ? (
                <View
                    style={[
                        styles.moderationNotice,
                        {
                            backgroundColor: warningColors.bg,
                            borderColor: warningColors.border,
                        },
                    ]}
                >
                    {hasActiveModeration ? (
                        <ActivityIndicator size="small" color={warningColors.icon} />
                    ) : (
                        <AlertCircle size={scale(20)} color={warningColors.icon} />
                    )}
                    <View style={styles.noticeCopy}>
                        <Text variant="body-sm" className="font-body-semi" style={{ color: warningColors.text }}>
                            {hasActiveModeration
                                ? t('image_moderation_checking', 'Checking photo')
                                : t('moderation_text_under_review', 'Under review')}
                        </Text>
                        <Text variant="caption" style={{ color: warningColors.text }}>
                            {hasActiveModeration
                                ? t(
                                    'image_moderation_checking_hint',
                                    'Automatic safety check in progress. You can continue using the app.',
                                )
                                : t(
                                    'image_moderation_pending_hint',
                                    'This photo is waiting for review and is hidden from other members.',
                                )}
                        </Text>
                    </View>
                </View>
            ) : null}

            {requiredError ? (
                <Text variant="caption" style={{ color: colors.brand.accent.error }}>
                    {requiredError}
                </Text>
            ) : null}

            {canUsePrivateGallery ? (
                <View style={[styles.privacyRow, { borderColor, backgroundColor: mutedSurface }]}>
                    <View style={[styles.privacyIcon, { backgroundColor: surface }]}>
                        {privacy === 'private' ? <Lock size={scale(18)} color={colors.brand.text.subtitle} /> : <Unlock size={scale(18)} color={colors.brand.text.subtitle} />}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text variant="body-sm" className="font-body-semi">{t('gallery_privacy_title', 'Keep my photos private')}</Text>
                        <Text variant="caption" style={{ color: mutedText, marginTop: scale(2) }}>
                            {gallery.length > 0
                                ? t('gallery_privacy_note', 'Your images will remain blurred for all members unless you approve visibility.')
                                : t('private_gallery_requires_image', 'Upload at least one photo before making your gallery private.')}
                        </Text>
                    </View>
                    <Pressable
                        onPress={togglePrivacy}
                        disabled={privacyBusy || gallery.length === 0}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: privacy === 'private', disabled: privacyBusy || gallery.length === 0 }}
                        style={[
                            styles.switchTrack,
                            {
                                backgroundColor: privacy === 'private' ? colors.chrome.primary : colors.brand.bg.border,
                                opacity: privacyBusy || gallery.length === 0 ? 0.55 : 1,
                            },
                        ]}
                    >
                        <View style={[styles.switchThumb, privacy === 'private' && styles.switchThumbOn]} />
                    </Pressable>
                </View>
            ) : null}

            <SingleSelectSheet
                visible={sourceSlot !== null}
                onClose={() => setSourceSlot(null)}
                onSelect={(source) => {
                    const slot = sourceSlot;
                    setSourceSlot(null);
                    if (slot === null) return;
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
                ]}
                title={t('add_photo', 'Add photo')}
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
        borderWidth: 1,
        borderRadius: scale(12),
        padding: scale(12),
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
        borderWidth: 1,
        borderRadius: scale(12),
        overflow: 'hidden',
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(3),
        borderRadius: scale(999),
        backgroundColor: 'rgba(24, 19, 14,0.72)',
        paddingHorizontal: scale(7),
        paddingVertical: scale(4),
    },
    primaryText: {
        color: '#FFFFFF',
        fontSize: scale(10),
        lineHeight: scale(12),
        fontWeight: '700',
    },
    busyOverlay: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(24, 19, 14,0.48)',
    },
    slotActions: {
        position: 'absolute',
        left: scale(8),
        right: scale(8),
        top: scale(8),
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: scale(6),
    },
    slotAction: {
        width: scale(30),
        height: scale(30),
        borderRadius: scale(15),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(24, 19, 14,0.72)',
    },
    deleteAction: {
        backgroundColor: '#E11D48',
    },
    moderationBadge: {
        position: 'absolute',
        left: scale(8),
        right: scale(8),
        bottom: scale(8),
        minHeight: scale(26),
        borderRadius: scale(999),
        paddingHorizontal: scale(7),
        paddingVertical: scale(4),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(4),
    },
    moderationBadgeText: {
        flexShrink: 1,
        color: '#FFFFFF',
        fontSize: scale(10),
        lineHeight: scale(13),
        fontWeight: '700',
    },
    badgeSpinner: {
        transform: [{ scale: 0.72 }],
    },
    deleteSpinner: {
        transform: [{ scale: 0.78 }],
    },
    moderationNotice: {
        minHeight: scale(76),
        borderWidth: 1,
        borderRadius: scale(10),
        paddingHorizontal: scale(12),
        paddingVertical: scale(11),
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: scale(10),
    },
    noticeCopy: {
        flex: 1,
        gap: scale(3),
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
