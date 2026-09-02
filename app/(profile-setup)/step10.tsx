import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { GradientButton } from '@/components/ui/GradientButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ProfileSetupHeader } from '@/components/ui/ProfileSetupHeader';
import { ProfileMediaEditor } from '@/components/profile/EditProfileMediaEditor';
import { ProfileSetupTokens } from '@/constants/uiTokens';
import { scale } from '@/hooks/useResponsive';
import { toast } from '@/hooks/useToast';
import type { GalleryItem, GalleryPrivacy } from '@/lib/galleryService';
import { profileService } from '@/lib/profileService';
import { useAuthStore } from '@/store/authStore';
import { useProfileSetupStore } from '@/store/profileSetupStore';

function translated(
    t: (key: string, options?: Record<string, unknown>) => string,
    key: string,
    fallback: string,
) {
    const value = t(key);
    return value && value !== key ? value : fallback;
}

export default function Step10() {
    const { t } = useTranslation('common');
    const { gender, profileData, reset } = useProfileSetupStore();
    const { user, refreshUser } = useAuthStore();
    const [gallery, setGallery] = useState<GalleryItem[]>([]);
    const [mediaBusy, setMediaBusy] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [galleryError, setGalleryError] = useState<string | null>(null);

    const profileGender = String(
        gender || profileData.gender || user?.profile?.gender || '',
    ).toLowerCase() === 'female'
        ? 'female'
        : 'male';
    const canUsePrivateGallery = profileGender === 'female';
    const guidelinesIdentity = String(user?._id || user?.email || 'current-user');

    const handleGalleryChange = useCallback(
        (payload: { gallery: GalleryItem[]; privacy: GalleryPrivacy }) => {
            setGallery(payload.gallery);
            if (payload.gallery.length > 0) setGalleryError(null);
        },
        [],
    );

    const handleSubmit = async () => {
        if (gallery.length === 0) {
            setGalleryError(
                translated(
                    t,
                    'profile_photo_required',
                    'Add at least one profile image to continue.',
                ),
            );
            return;
        }

        setSubmitting(true);
        const response = await profileService.updateProfile({ newProfile: false });
        if (response.success) {
            await refreshUser();
            reset();
            router.replace('/(tabs)/search');
        } else {
            toast.show(
                translated(t, response.message || 'something_went_wrong', 'Something went wrong.'),
                'error',
            );
        }
        setSubmitting(false);
    };

    return (
        <SafeAreaView className="flex-1 bg-brand-bg-primary">
            <ProgressBar currentStep={10} />
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={ProfileSetupTokens.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <ProfileSetupHeader
                    step={10}
                    title={translated(t, 'profile_summary', 'Photos and Profile Summary')}
                    subtitle={translated(
                        t,
                        'profile_summary_desc',
                        'Add images, your headline and a short bio to personalize the profile.',
                    )}
                />

                <ProfileMediaEditor
                    variant="onboarding"
                    canUsePrivateGallery={canUsePrivateGallery}
                    gender={profileGender}
                    guidelinesIdentity={guidelinesIdentity}
                    autoShowGuidelines
                    requiredError={galleryError || undefined}
                    onGalleryChange={handleGalleryChange}
                    onBusyChange={setMediaBusy}
                />
            </ScrollView>

            <View style={styles.footer}>
                <GradientButton
                    title={translated(t, 'finish', 'Finish')}
                    onPress={handleSubmit}
                    loading={submitting}
                    disabled={submitting || mediaBusy}
                    widthMode="full"
                    height={40}
                    textSize={15}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    scroll: {
        flex: 1,
    },
    footer: {
        paddingHorizontal: scale(20),
        paddingTop: scale(12),
        paddingBottom: scale(10),
    },
});
