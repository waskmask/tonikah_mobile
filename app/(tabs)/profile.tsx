import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, InteractionManager, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import EditProfileScreen from './edit-profile';
import { Text } from '@/components/ui/Text';
import { UserProfileView } from '@/components/profile/UserProfileView';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { galleryService, GalleryItem, GalleryPrivacy, GalleryResponse } from '@/lib/galleryService';
import { profileService } from '@/lib/profileService';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/store/authStore';
import { DevRenderProfiler } from '@/components/dev/DevRenderProfiler';

type ProfileData = Record<string, any>;
type ProfileMode = 'edit' | 'preview';
const PROFILE_TAB_BAR_HEIGHT = 48;

const MemoizedUserProfileView = React.memo(UserProfileView);
const PROFILE_MODES: Array<{ value: ProfileMode; labelKey: string; fallback: string }> = [
    { value: 'edit', labelKey: 'edit_profile', fallback: 'Edit profile' },
    { value: 'preview', labelKey: 'preview', fallback: 'Preview' },
];

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

function preserveReplacedApprovedGallery(current: GalleryItem[], next: GalleryItem[]) {
    const replacedUuids = new Set(
        next
            .filter((item) => item.safe === false && item.replacesUuid)
            .map((item) => String(item.replacesUuid)),
    );
    if (!replacedUuids.size) return normalizeGallery(next);

    const retained = current.filter((item) =>
        item.safe !== false
        && replacedUuids.has(String(item.uuid))
        && !next.some((candidate) => String(candidate.uuid) === String(item.uuid)),
    );
    return normalizeGallery([...next, ...retained]);
}

function sameGallery(left: GalleryItem[], right: GalleryItem[]) {
    if (left === right) return true;
    if (left.length !== right.length) return false;
    return left.every((item, index) => JSON.stringify(item) === JSON.stringify(right[index]));
}

function profilePartnerPreference(profile: ProfileData | null | undefined) {
    return profile?.partner_preference || profile?.partnerPreference || null;
}

function hasPartnerPreference(preference: any) {
    return Boolean(preference && typeof preference === 'object' && Object.keys(preference).length > 0);
}

function ProfileModeBar({ mode, onChange }: { mode: ProfileMode; onChange: (mode: ProfileMode) => void }) {
    const colors = useColors();
    const { t } = useLanguage();
    const layouts = useRef<Partial<Record<ProfileMode, { x: number; width: number }>>>({});
    const indicatorReady = useRef(false);
    const indicatorX = useSharedValue(0);
    const indicatorWidth = useSharedValue(0);
    const indicatorOpacity = useSharedValue(0);
    const labelFor = useCallback((labelKey: string, fallback: string) => {
        const translated = String(t(labelKey) || '');
        return translated && translated !== labelKey ? translated : fallback;
    }, [t]);

    useEffect(() => {
        const layout = layouts.current[mode];
        if (!layout) return;
        if (!indicatorReady.current) {
            indicatorX.value = layout.x;
            indicatorWidth.value = layout.width;
            indicatorOpacity.value = 1;
            indicatorReady.current = true;
            return;
        }
        const timing = { duration: 220, easing: Easing.out(Easing.cubic) };
        indicatorX.value = withTiming(layout.x, timing);
        indicatorWidth.value = withTiming(layout.width, timing);
    }, [indicatorOpacity, indicatorWidth, indicatorX, mode]);

    const indicatorStyle = useAnimatedStyle(() => ({
        opacity: indicatorOpacity.value,
        width: indicatorWidth.value,
        transform: [{ translateX: indicatorX.value }],
    }));

    return (
        <SafeAreaView
            edges={['top']}
            style={[styles.modeSafeArea, { backgroundColor: colors.chrome.header.background }]}
        >
            <View style={styles.modeRow} accessibilityRole="tablist">
                {PROFILE_MODES.map((item) => (
                    <Pressable
                        key={item.value}
                        onPress={() => onChange(item.value)}
                        onLayout={(event) => {
                            const { x, width } = event.nativeEvent.layout;
                            layouts.current[item.value] = { x, width };
                            if (mode === item.value && !indicatorReady.current) {
                                indicatorX.value = x;
                                indicatorWidth.value = width;
                                indicatorOpacity.value = 1;
                                indicatorReady.current = true;
                            }
                        }}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: mode === item.value }}
                        style={styles.modeSlot}
                    >
                        <View pointerEvents="none" style={styles.modeButton}>
                            <Text
                                numberOfLines={1}
                                className="font-body-semi"
                                style={[
                                    styles.modeLabel,
                                    {
                                        color: mode === item.value
                                            ? colors.chrome.header.title
                                            : colors.chrome.header.subtitle,
                                    },
                                ]}
                            >
                                {labelFor(item.labelKey, item.fallback)}
                            </Text>
                        </View>
                    </Pressable>
                ))}
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.modeIndicator,
                        { backgroundColor: colors.chrome.header.title },
                        indicatorStyle,
                    ]}
                />
            </View>
        </SafeAreaView>
    );
}

export default function ProfileScreen() {
    const colors = useColors();
    const { width: pageWidth } = useWindowDimensions();
    const queryClient = useQueryClient();
    const authUser = useAuthStore((state) => state.user);
    const setUser = useAuthStore((state) => state.setUser);
    const patchUserProfile = useAuthStore((state) => state.patchUserProfile);
    const initialUserRef = useRef(authUser);
    const appliedUserRef = useRef(initialUserRef.current);
    const initialGalleryRef = useRef(
        queryClient.getQueryData<GalleryResponse>(queryKeys.gallery.me),
    );
    const hasFocusedRef = useRef(false);
    const partnerPreferenceLoadStartedRef = useRef(false);
    const { data: sharedGalleryResponse } = useQuery<GalleryResponse>({
        queryKey: queryKeys.gallery.me,
        queryFn: galleryService.fetchMe,
        enabled: false,
    });
    const [mode, setMode] = useState<ProfileMode>('edit');
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
    const [editRefreshVersion, setEditRefreshVersion] = useState(0);
    const [error, setError] = useState('');
    const pageOffset = useSharedValue(0);
    const gestureStartOffset = useSharedValue(0);
    const selectedPage = useSharedValue(0);

    useEffect(() => {
        const nextPage = mode === 'preview' ? 1 : 0;
        selectedPage.value = nextPage;
        pageOffset.value = withTiming(-nextPage * pageWidth, {
            duration: 220,
            easing: Easing.out(Easing.cubic),
        });
    }, [mode, pageOffset, pageWidth, selectedPage]);

    const pagerStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: pageOffset.value }],
    }));

    const pagerGesture = useMemo(() => Gesture.Pan()
        .activeOffsetX([-18, 18])
        .failOffsetY([-14, 14])
        .onStart(() => {
            gestureStartOffset.value = pageOffset.value;
        })
        .onUpdate((event) => {
            pageOffset.value = Math.max(-pageWidth, Math.min(0, gestureStartOffset.value + event.translationX));
        })
        .onEnd((event) => {
            const projectedOffset = pageOffset.value + event.velocityX * 0.12;
            const nextPage = projectedOffset < -pageWidth * 0.5 ? 1 : 0;
            selectedPage.value = nextPage;
            pageOffset.value = withTiming(-nextPage * pageWidth, {
                duration: 220,
                easing: Easing.out(Easing.cubic),
            });
            runOnJS(setMode)(nextPage === 1 ? 'preview' : 'edit');
        })
        .onFinalize(() => {
            pageOffset.value = withTiming(-selectedPage.value * pageWidth, {
                duration: 220,
                easing: Easing.out(Easing.cubic),
            });
        }), [gestureStartOffset, pageOffset, pageWidth, selectedPage]);

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

        appliedUserRef.current = meRes.user;
        setUser(meRes.user);
        if (galleryRes.success) {
            queryClient.setQueryData(queryKeys.gallery.me, galleryRes);
        }
        setProfile((current) => {
            const currentGallery = Array.isArray(current?.gallery) ? current.gallery : [];
            const gallery = galleryRes.success && Array.isArray(galleryRes.gallery)
                ? preserveReplacedApprovedGallery(currentGallery, galleryRes.gallery)
                : currentGallery;
            const privacy = galleryRes.success
                ? galleryRes.privacy || 'public'
                : current?.privacy || 'public';
            return mergeProfile(meRes.user, gallery, privacy);
        });
    }, [queryClient, setUser]);

    const refreshProfile = useCallback(async () => {
        if (refreshing) return;
        setRefreshing(true);
        try {
            const [profileResult, partnerResult] = await Promise.allSettled([
                loadProfile(),
                profileService.fetchPartnerPreference(),
            ]);

            if (profileResult.status === 'rejected') throw profileResult.reason;
            if (partnerResult.status === 'fulfilled' && partnerResult.value.success !== false) {
                const preference = partnerResult.value.partner_preference || {};
                queryClient.setQueryData(queryKeys.profile.partnerPreference, preference);
                patchUserProfile({
                    partner_preference: preference,
                    partnerPreference: preference,
                });
                setProfile((current) => current ? {
                    ...current,
                    partner_preference: preference,
                    partnerPreference: preference,
                } : current);
            }
            setEditRefreshVersion((current) => current + 1);
        } catch (refreshError) {
            setError(String((refreshError as any)?.message || 'profile_refresh_failed'));
        } finally {
            setRefreshing(false);
        }
    }, [loadProfile, patchUserProfile, queryClient, refreshing]);

    useEffect(() => {
        if (!authUser || authUser === appliedUserRef.current) return;
        appliedUserRef.current = authUser;
        setProfile((current) => mergeProfile(
            authUser,
            Array.isArray(current?.gallery) ? current.gallery : [],
            current?.privacy || 'public',
        ));
    }, [authUser]);

    useFocusEffect(
        useCallback(() => {
            setMode('edit');
            if (hasFocusedRef.current) {
                void loadProfile();
            } else {
                hasFocusedRef.current = true;
            }
        }, [loadProfile]),
    );

    useEffect(() => {
        if (!sharedGalleryResponse?.success) return;
        const incomingGallery = sharedGalleryResponse.gallery || [];
        const privacy = sharedGalleryResponse.privacy || 'public';
        setProfile((current) => {
            if (!current) return current;
            const currentGallery = Array.isArray(current.gallery) ? current.gallery : [];
            const gallery = preserveReplacedApprovedGallery(currentGallery, incomingGallery);
            if (current.privacy === privacy && sameGallery(currentGallery, gallery)) return current;
            return { ...current, gallery, privacy };
        });
    }, [sharedGalleryResponse]);

    useEffect(() => {
        const preference = profilePartnerPreference(profile);
        if (!hasPartnerPreference(preference)) return;
        queryClient.setQueryData(queryKeys.profile.partnerPreference, preference);
    }, [profile, queryClient]);

    useEffect(() => {
        if (mode !== 'preview') return;

        const cached = queryClient.getQueryData<any>(queryKeys.profile.partnerPreference);
        if (hasPartnerPreference(cached)) {
            setProfile((current) => {
                if (!current || profilePartnerPreference(current) === cached) return current;
                return { ...current, partner_preference: cached };
            });
            return;
        }
        if (hasPartnerPreference(profilePartnerPreference(profile)) || partnerPreferenceLoadStartedRef.current) return;

        const interaction = InteractionManager.runAfterInteractions(() => {
            partnerPreferenceLoadStartedRef.current = true;
            void queryClient.fetchQuery({
                queryKey: queryKeys.profile.partnerPreference,
                queryFn: async () => {
                    const response = await profileService.fetchPartnerPreference();
                    if (response.success === false) throw new Error(response.message || 'partner_preference_unavailable');
                    return response.partner_preference || {};
                },
                staleTime: 15 * 60_000,
                gcTime: 30 * 60_000,
                retry: false,
            }).then((preference) => {
                setProfile((current) => current ? { ...current, partner_preference: preference } : current);
            }).catch(() => undefined)
                .finally(() => {
                    partnerPreferenceLoadStartedRef.current = false;
                });
        });

        return () => interaction.cancel();
    }, [mode, profile, queryClient]);

    useEffect(() => {
        void loadProfile().finally(() => setLoading(false));
    }, [loadProfile]);

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
        <View style={[styles.root, { backgroundColor: colors.brand.bg.surface }]}>
            <ProfileModeBar mode={mode} onChange={setMode} />
            <GestureDetector gesture={pagerGesture}>
                <View style={styles.content}>
                    <Animated.View
                        style={[
                            styles.pageTrack,
                            { width: pageWidth * 2 },
                            pagerStyle,
                        ]}
                    >
                        <View style={[styles.page, { width: pageWidth }]}>
                            <EditProfileScreen
                                key={editRefreshVersion}
                                embedded
                                active={mode === 'edit'}
                            />
                        </View>
                        <View style={[styles.page, { width: pageWidth }]}>
                            <DevRenderProfiler id="ProfilePreview">
                                <MemoizedUserProfileView
                                    initialProfile={profile}
                                    mode="screen"
                                    showClose={false}
                                    showHeader={false}
                                    isOwnProfile
                                    publicPreview
                                    showPartnerPreferenceEdit
                                    refreshing={refreshing}
                                    onRefresh={refreshProfile}
                                />
                            </DevRenderProfiler>
                        </View>
                    </Animated.View>
                </View>
            </GestureDetector>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modeSafeArea: {
        zIndex: 2,
    },
    modeRow: {
        width: '100%',
        height: PROFILE_TAB_BAR_HEIGHT,
        flexDirection: 'row',
        alignItems: 'stretch',
        position: 'relative',
    },
    modeSlot: {
        width: '50%',
        flexGrow: 0,
        flexShrink: 0,
        minWidth: 0,
        height: PROFILE_TAB_BAR_HEIGHT,
        alignSelf: 'stretch',
    },
    modeButton: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: scale(12),
    },
    modeLabel: {
        width: '100%',
        textAlign: 'center',
        fontSize: scale(15),
        lineHeight: scale(20),
        fontWeight: '600',
    },
    modeIndicator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        height: scale(2),
    },
    content: {
        flex: 1,
        overflow: 'hidden',
    },
    pageTrack: {
        flex: 1,
        flexDirection: 'row',
        direction: 'ltr',
    },
    page: {
        height: '100%',
    },
});
