import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { UserProfileView } from '@/components/profile/UserProfileView';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';
import { galleryService, GalleryItem, GalleryPrivacy } from '@/lib/galleryService';
import { profileService } from '@/lib/profileService';
import { useAuthStore } from '@/store/authStore';

type ProfileData = Record<string, any>;

function normalizeGallery(items: GalleryItem[]) {
    return [...items].sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;
        return (a.sort_index ?? 0) - (b.sort_index ?? 0);
    });
}

function mergeProfile(user: any, gallery: GalleryItem[], privacy: GalleryPrivacy): ProfileData {
    const profile = user?.profile || {};
    return {
        ...user,
        ...profile,
        id: user?.id || user?._id || profile?.id || profile?._id,
        user_id: user?.id || user?._id || profile?.user_id,
        profileName: profile?.profileName || user?.profileName || user?.name || user?.username,
        gallery,
        privacy,
    };
}

export default function ProfileScreen() {
    const colors = useColors();
    const { user, setUser } = useAuthStore();
    const [profile, setProfile] = useState<ProfileData | null>(() =>
        user ? mergeProfile(user, [], 'public') : null,
    );
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');

    const loadProfile = useCallback(async () => {
        setError('');
        const [meRes, galleryRes] = await Promise.all([
            profileService.fetchMe(),
            galleryService.fetchMe(),
        ]);

        if (!meRes.success || !meRes.user) {
            setError(meRes.message || 'profile_unavailable');
            return;
        }

        const gallery = Array.isArray(galleryRes.gallery) ? normalizeGallery(galleryRes.gallery) : [];
        const privacy = galleryRes.privacy || 'public';
        setUser(meRes.user);
        setProfile(mergeProfile(meRes.user, gallery, privacy));
    }, [setUser]);

    useEffect(() => {
        (async () => {
            setLoading(true);
            await loadProfile();
            setLoading(false);
        })();
    }, [loadProfile]);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        await loadProfile();
        setRefreshing(false);
    }, [loadProfile]);

    const viewProfile = useMemo(() => profile, [profile]);

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.brand.bg.surface }]}>
                <ActivityIndicator color={colors.chrome.primary} />
            </View>
        );
    }

    if (error || !viewProfile) {
        return (
            <View style={[styles.center, { backgroundColor: colors.brand.bg.surface, padding: scale(24) }]}>
                <Text variant="h3" align="center">
                    {error || 'Profile unavailable'}
                </Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: colors.brand.bg.surface }}>
            <UserProfileView
                initialProfile={viewProfile}
                mode="screen"
                showClose={false}
                isOwnProfile
                onEditProfile={() => router.push('/(tabs)/edit-profile')}
                refreshing={refreshing}
                onRefresh={refresh}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
