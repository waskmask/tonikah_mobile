import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ArrowUp, ImagePlus, Lock, Pencil, Star, Trash2, Unlock } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { GalleryCropModal } from '@/components/app/GalleryCropModal';
import { galleryService, GalleryItem, GalleryPrivacy } from '@/lib/galleryService';
import { PROFILE_PLACEHOLDER_IMAGE } from '@/lib/profileAssets';
import { apiMessage, t } from '@/lib/profileDisplay';
import { useTheme } from '@/hooks/useTheme';
import { useColors } from '@/hooks/useColors';
import { useToast } from '@/hooks/useToast';
import { scale } from '@/hooks/useResponsive';

const GALLERY_MAX_SLOTS = 3;

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
    onGalleryChange?: (payload: { gallery: GalleryItem[]; privacy: GalleryPrivacy; avatarUuid?: string | null }) => void;
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

export function EditProfileMediaEditor({ canUsePrivateGallery, initialGallery = [], initialPrivacy = 'public', onGalleryChange }: Props) {
    const { isDark } = useTheme();
    const colors = useColors();
    const toast = useToast();
    const [privacy, setPrivacy] = useState<GalleryPrivacy>(canUsePrivateGallery ? initialPrivacy : 'public');
    const [gallery, setGallery] = useState<GalleryItem[]>(() => normalizeGallery(initialGallery));
    const [loading, setLoading] = useState(true);
    const [busySlot, setBusySlot] = useState<number | null>(null);
    const [deletingUuid, setDeletingUuid] = useState<string | null>(null);
    const [privacyBusy, setPrivacyBusy] = useState(false);
    const [cropDraft, setCropDraft] = useState<CropDraft | null>(null);
    const [cropError, setCropError] = useState<string | null>(null);

    const slots = useMemo(
        () => Array.from({ length: GALLERY_MAX_SLOTS }, (_, index) => gallery[index] ?? null),
        [gallery]
    );

    const borderColor = colors.brand.bg.border;
    const surface = colors.chrome.common.card;
    const mutedSurface = colors.brand.bg.surface;
    const mutedText = colors.brand.text.subtitle;

    const refreshGallery = useCallback(async (showLoader = false) => {
        if (showLoader) setLoading(true);
        const res = await galleryService.fetchMe();
        if (res.success) {
            const responsePrivacy = res.privacy || 'public';
            const nextPrivacy = canUsePrivateGallery || responsePrivacy === 'private' ? responsePrivacy : 'public';
            const nextGallery = normalizeGallery(res.gallery || []);
            setPrivacy(nextPrivacy);
            setGallery(nextGallery);
            onGalleryChange?.({ gallery: nextGallery, privacy: nextPrivacy, avatarUuid: res.avatarUuid });
        } else {
            toast.show(apiMessage(res.message), 'error');
        }
        if (showLoader) setLoading(false);
        return res;
    }, [canUsePrivateGallery, onGalleryChange, toast]);

    useEffect(() => {
        refreshGallery(true);
    }, [refreshGallery]);

    const pickImage = async (slotIndex: number) => {
        if (gallery.length >= GALLERY_MAX_SLOTS && !gallery[slotIndex]) {
            toast.show(t('gallery_limit_reached', 'Gallery limit reached.'), 'warning', 2500);
            return;
        }
        setCropError(null);
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted') {
            toast.show(t('photo_permission_required', 'Photo library permission is required.'), 'error');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 1,
            allowsMultipleSelection: false,
        });
        if (result.canceled || !result.assets?.[0]?.uri) return;
        const asset = result.assets[0];
        setCropDraft({ uri: asset.uri, slotIndex, width: asset.width, height: asset.height });
    };

    const uploadCroppedImage = async (uri: string) => {
        if (!cropDraft) return;
        const slotIndex = cropDraft.slotIndex;
        setBusySlot(slotIndex);
        setCropError(null);
        try {
            const replaceUuid = gallery[slotIndex]?.uuid;
            if (replaceUuid) {
                const removeRes = await galleryService.remove(replaceUuid);
                if (!removeRes.success && removeRes.status && removeRes.status >= 400) {
                    throw new Error(removeRes.message || 'gallery_upload_error');
                }
            }

            const formData = new FormData();
            formData.append('image', {
                uri,
                name: 'gallery.jpg',
                type: 'image/jpeg',
            } as any);

            const uploadRes = await galleryService.upload(formData);
            if (!uploadRes.success || !uploadRes.image?.uuid) {
                throw new Error(uploadRes.message || 'upload_failed');
            }

            const galleryRes = await refreshGallery(false);
            if (!galleryRes.success || !galleryRes.gallery?.some((item) => item.uuid === uploadRes.image?.uuid)) {
                throw new Error('gallery_upload_error');
            }

            setCropDraft(null);
            toast.show(t('gallery_photo_uploaded_success', 'Photo uploaded successfully.'), 'success', 2500);
        } catch (error: any) {
            const message = t(error?.message || 'gallery_upload_error', 'Could not upload photo.');
            setCropError(message);
            toast.show(message, 'error');
        } finally {
            setBusySlot(null);
        }
    };

    const removeImage = async (uuid: string) => {
        setDeletingUuid(uuid);
        const res = await galleryService.remove(uuid);
        if (res.success) {
            await refreshGallery(false);
            toast.show(t('gallery_photo_deleted_success', 'Photo removed successfully.'), 'success', 2500);
        } else {
            toast.show(apiMessage(res.message), 'error');
        }
        setDeletingUuid(null);
    };

    const makePrimary = async (uuid: string) => {
        const res = await galleryService.makePrimary(uuid);
        if (res.success) {
            await refreshGallery(false);
            toast.show(t('profile_updated_success', 'Profile updated successfully.'), 'success', 2500);
        } else {
            toast.show(apiMessage(res.message), 'error');
        }
    };

    const togglePrivacy = async () => {
        if (privacyBusy) return;
        const next = privacy === 'private' ? 'public' : 'private';
        if (next === 'private' && !canUsePrivateGallery) return;
        const previous = privacy;
        setPrivacy(next);
        setPrivacyBusy(true);
        const res = await galleryService.updatePrivacy(next);
        if (res.success) {
            toast.show(t('privacy_updated_to', 'Privacy updated.', { pkey: t(`privacy_${next}`, next) }), 'success', 2500);
            await refreshGallery(false);
        } else {
            setPrivacy(previous);
            toast.show(apiMessage(res.message || 'privacy_error'), 'error');
        }
        setPrivacyBusy(false);
    };

    return (
        <View style={[styles.section, { borderColor, backgroundColor: surface }]}>
            <View style={styles.sectionHeader}>
                <Text variant="body" className="font-body-bold" style={styles.sectionTitle}>
                    {t('photo_gallery', 'Photo gallery')}
                </Text>
                <Text variant="caption" style={{ color: mutedText }}>
                    {gallery.length}/{GALLERY_MAX_SLOTS}
                </Text>
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
                        const busy = busySlot === index || deletingUuid === uuid;
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

                                {busy ? (
                                    <View style={styles.busyOverlay}>
                                        <ActivityIndicator color={colors.chrome.common.inverseText} />
                                    </View>
                                ) : null}

                                {item ? (
                                    <View style={styles.slotActions}>
                                        <Pressable onPress={() => pickImage(index)} style={styles.slotAction} hitSlop={8}>
                                            <Pencil size={scale(14)} color={colors.chrome.common.inverseText} />
                                        </Pressable>
                                        {!primary ? (
                                            <Pressable onPress={() => uuid && makePrimary(uuid)} style={styles.slotAction} hitSlop={8}>
                                                <ArrowUp size={scale(15)} color={colors.chrome.common.inverseText} />
                                            </Pressable>
                                        ) : null}
                                        <Pressable onPress={() => uuid && removeImage(uuid)} style={[styles.slotAction, styles.deleteAction]} hitSlop={8}>
                                            <Trash2 size={scale(14)} color={colors.chrome.common.inverseText} />
                                        </Pressable>
                                    </View>
                                ) : null}
                            </Pressable>
                        );
                    })}
                </View>
            )}

            {canUsePrivateGallery || privacy === 'private' ? (
                <View style={[styles.privacyRow, { borderColor, backgroundColor: mutedSurface }]}>
                    <View style={[styles.privacyIcon, { backgroundColor: surface }]}>
                        {privacy === 'private' ? <Lock size={scale(18)} color={colors.brand.text.subtitle} /> : <Unlock size={scale(18)} color={colors.brand.text.subtitle} />}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text variant="body-sm" className="font-body-semi">{t('gallery_privacy_title', 'Keep my photos private')}</Text>
                        <Text variant="caption" style={{ color: mutedText, marginTop: scale(2) }}>
                            {t('gallery_privacy_note', 'Your images will remain blurred for all members unless you approve visibility.')}
                        </Text>
                    </View>
                    <Pressable
                        onPress={togglePrivacy}
                        disabled={privacyBusy}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: privacy === 'private', disabled: privacyBusy }}
                        style={[styles.switchTrack, { backgroundColor: privacy === 'private' ? colors.chrome.primary : colors.brand.bg.border }]}
                    >
                        <View style={[styles.switchThumb, privacy === 'private' && styles.switchThumbOn]} />
                    </Pressable>
                </View>
            ) : null}

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
                    toast.show(errorMessage, 'error');
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        borderWidth: 1,
        borderRadius: scale(12),
        padding: scale(12),
        gap: scale(12),
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitle: {
        fontSize: scale(16),
        lineHeight: scale(21),
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
        bottom: scale(8),
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
