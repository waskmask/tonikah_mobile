import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '@/components/ui/Text';
import { UserProfileView } from '@/components/profile/UserProfileView';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';
import { galleryService, GalleryItem, GalleryPrivacy, GalleryResponse } from '@/lib/galleryService';
import { profileService } from '@/lib/profileService';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/store/authStore';
import { DevRenderProfiler } from '@/components/dev/DevRenderProfiler';
import { useAppMenu } from '@/components/app/AppMenuProvider';

type ProfileData = Record<string, any>;
const MemoizedUserProfileView = React.memo(UserProfileView);

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

function sameGallery(left: GalleryItem[], right: GalleryItem[]) {
    if (left === right) return true;
    if (left.length !== right.length) return false;
    return left.every((item, index) => JSON.stringify(item) === JSON.stringify(right[index]));
}

export default function ProfileScreen() {
    const colors = useColors();
    const { openMenu } = useAppMenu();
    const setUser = useAuthStore((state) => state.setUser);
    const queryClient = useQueryClient();
    const initialUserRef = useRef(useAuthStore.getState().user);
    const appliedUserRef = useRef(initialUserRef.current);
    const initialGalleryRef = useRef(
        queryClient.getQueryData<GalleryResponse>(queryKeys.gallery.me),
    );
    const { data: sharedGalleryResponse } = useQuery<GalleryResponse>({
        queryKey: queryKeys.gallery.me,
        queryFn: galleryService.fetchMe,
        enabled: false,
    });
    const [profile, setProfile] = useState<ProfileData | null>(() =>
        initialUserRef.current
            ? mergeProfile(
                initialUserRef.current,
                normalizeGallery(initialGalleryRef.current?.gallery || []),
                initialGalleryRef.current?.privacy || 'public',
            )
            : null,
    );
    const [loading, setLoading] = useState(!profile);
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

        // ProfileScreen does not subscribe to the whole auth store. Apply this
        // response once locally, then publish it for the rest of the app.
        appliedUserRef.current = meRes.user;
        setUser(meRes.user);
        if (galleryRes.success) {
            queryClient.setQueryData(queryKeys.gallery.me, galleryRes);
        }
        setProfile((current) => {
            const currentGallery = Array.isArray(current?.gallery) ? current.gallery : [];
            const gallery = galleryRes.success && Array.isArray(galleryRes.gallery)
                ? normalizeGallery(galleryRes.gallery)
                : currentGallery;
            const privacy = galleryRes.success
                ? galleryRes.privacy || 'public'
                : current?.privacy || 'public';
            return mergeProfile(meRes.user, gallery, privacy);
        });
    }, [queryClient, setUser]);

    useEffect(() => {
        router.prefetch('/(tabs)/edit-profile');
    }, []);

    // Hidden tab screens should not rebuild the full profile whenever another
    // screen refreshes /me. Reconcile the latest cached user once on focus.
    useFocusEffect(
        useCallback(() => {
            const latestUser = useAuthStore.getState().user;
            if (!latestUser || latestUser === appliedUserRef.current) return;
            appliedUserRef.current = latestUser;
            setProfile((current) => mergeProfile(
                latestUser,
                Array.isArray(current?.gallery) ? current.gallery : [],
                current?.privacy || 'public',
            ));
        }, []),
    );

    useEffect(() => {
        if (!sharedGalleryResponse?.success) return;
        const gallery = normalizeGallery(sharedGalleryResponse.gallery || []);
        const privacy = sharedGalleryResponse.privacy || 'public';
        setProfile((current) => {
            if (!current) return current;
            const currentGallery = Array.isArray(current.gallery) ? current.gallery : [];
            if (current.privacy === privacy && sameGallery(currentGallery, gallery)) return current;
            return { ...current, gallery, privacy };
        });
    }, [sharedGalleryResponse]);

    useEffect(() => {
        (async () => {
            await loadProfile();
            setLoading(false);
        })();
    }, [loadProfile]);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await loadProfile();
        } finally {
            setRefreshing(false);
        }
    }, [loadProfile]);

    const openEditProfile = useCallback(() => {
        router.push({
            pathname: '/(tabs)/edit-profile',
            params: { returnTo: '/(tabs)/profile' },
        });
    }, []);

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.brand.bg.surface }]}>
                <ActivityIndicator color={colors.chrome.primary} />
            </View>
        );
    }

    if (!profile) {
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
            <DevRenderProfiler id="ProfileScreen">
                <MemoizedUserProfileView
                    initialProfile={profile}
                    mode="screen"
                    showClose={false}
                    isOwnProfile
                    onEditProfile={openEditProfile}
                    onOpenMenu={openMenu}
                    refreshing={refreshing}
                    onRefresh={refresh}
                    onReconcile={loadProfile}
                />
            </DevRenderProfiler>
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
