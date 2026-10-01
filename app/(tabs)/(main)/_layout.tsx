import { useEffect } from 'react';
import { Platform, StyleSheet, Text as NativeText, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { User } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppMenuProvider } from '@/components/app/AppMenuProvider';
import { MembershipAccessListener } from '@/components/app/MembershipAccessListener';
import { usePeriodicLocationRefresh } from '@/hooks/usePeriodicLocationRefresh';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scheduleIdleWork } from '@/lib/idleWork';
import { chatService } from '@/lib/chatService';
import { profileService } from '@/lib/profileService';
import { profileAvatarImage } from '@/lib/profileDisplay';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/store/authStore';
import { Typography } from '@/constants/typography';
import { formatBadgeCount, NavigationTypeTokens } from '@/constants/uiTokens';

type MySummary = {
    avatarThumbUrl: string;
    completionPercent: number;
};

const TRANSPARENT_TAB_ICON = {
    uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
};
const ANDROID_TAB_ICON_SIZE = 26;
const ANDROID_TAB_BAR_CONTENT_HEIGHT = 68;
const ANDROID_TAB_INDICATOR_TOP = 12;
const ANDROID_TAB_INDICATOR_HEIGHT = 32;
const ANDROID_PROFILE_AVATAR_VERTICAL_OFFSET = 5;
const ANDROID_TAB_ICON_TOP = ANDROID_TAB_INDICATOR_TOP
    + (ANDROID_TAB_INDICATOR_HEIGHT - ANDROID_TAB_ICON_SIZE) / 2;

function safeLabel(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function unreadFromResponse(value: any) {
    return Number(value?.unreadCount ?? value?.count ?? value?.data?.unreadCount ?? value?.data?.count ?? 0) || 0;
}

export default function TabsLayout() {
    usePeriodicLocationRefresh();

    const colors = useColors();
    const tabChrome = colors.chrome.tabBar;
    const { width: windowWidth } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const { currentLanguage, isRTL, t } = useLanguage();
    const queryClient = useQueryClient();
    const cachedUser = useAuthStore((state) => state.user);
    const patchUserProfile = useAuthStore((state) => state.patchUserProfile);
    const labelFontFamily = currentLanguage === 'ar'
        ? Typography.font.arabic.semi
        : Typography.font.body.medium;
    const selectedLabelFontFamily = currentLanguage === 'ar'
        ? Typography.font.arabic.bold
        : Typography.font.body.bold;

    const { data: unreadCount = 0 } = useQuery({
        queryKey: queryKeys.chat.unreadCount,
        queryFn: async () => unreadFromResponse(await chatService.unreadCount()),
        staleTime: 15_000,
    });
    const { data: mySummary = null } = useQuery<MySummary | null>({
        queryKey: queryKeys.profile.mySummary,
        queryFn: async () => {
            const response = await profileService.fetchMySummary();
            const summaryUser = response?.user;
            if (!response?.success || !summaryUser) return null;
            const summary = {
                avatarThumbUrl: String(summaryUser.avatarThumbUrl || summaryUser.avatarUrl || ''),
                completionPercent: Number(summaryUser.completionPercent) || 0,
            };
            patchUserProfile(summary);
            return summary;
        },
        staleTime: 60_000,
    });

    useChatSocket({
        onUnread: (payload) => {
            queryClient.setQueryData(queryKeys.chat.unreadCount, unreadFromResponse(payload));
        },
    });

    useEffect(() => scheduleIdleWork(() => {
        router.prefetch('/hobbies-faith');
        router.prefetch('/partner-preference');
        router.prefetch('/language');
        router.prefetch('/blocked-users');
        router.prefetch('/settings');
        router.prefetch('/(tabs)/profile');
    }), []);

    const cachedProfile = cachedUser?.profile || cachedUser;
    const cachedCompletion = cachedProfile?.completionPercent ?? cachedUser?.completionPercent;
    const rawCompletion = mySummary?.completionPercent ?? cachedCompletion;
    const hasCompletion = rawCompletion !== undefined && rawCompletion !== null && Number.isFinite(Number(rawCompletion));
    const completionPercent = Math.min(100, Math.max(0, Math.round(Number(rawCompletion) || 0)));
    const profileBadge = hasCompletion && completionPercent < 100 ? `${completionPercent}%` : '';
    const profileAvatarUrl = mySummary?.avatarThumbUrl || profileAvatarImage(cachedProfile);
    const androidAvatarLeft = (isRTL ? windowWidth / 8 : windowWidth * 7 / 8) - ANDROID_TAB_ICON_SIZE / 2;
    const androidAvatarBottom = insets.bottom
        + ANDROID_TAB_BAR_CONTENT_HEIGHT
        - ANDROID_TAB_ICON_TOP
        - ANDROID_TAB_ICON_SIZE
        + ANDROID_PROFILE_AVATAR_VERTICAL_OFFSET;

    return (
        <AppMenuProvider>
            <MembershipAccessListener />
            <View style={styles.navigatorHost}>
                <NativeTabs
                backBehavior="history"
                minimizeBehavior="never"
                disableTransparentOnScrollEdge
                labelVisibilityMode="labeled"
                labelStyle={{
                    default: {
                        fontFamily: labelFontFamily,
                        fontSize: NavigationTypeTokens.tabLabel.fontSize,
                        fontWeight: '500',
                        color: tabChrome.label,
                    },
                    selected: {
                        fontFamily: selectedLabelFontFamily,
                        fontSize: NavigationTypeTokens.tabLabel.selectedFontSize,
                        fontWeight: '700',
                        color: tabChrome.label,
                    },
                }}
                iconColor={{ default: tabChrome.inactive, selected: tabChrome.activeIcon }}
                backgroundColor={Platform.OS === 'android' ? tabChrome.background : undefined}
                indicatorColor={tabChrome.activePill}
                rippleColor={colors.chrome.common.primaryGlow}
                badgeBackgroundColor={colors.chrome.badge.background}
                badgeTextColor={colors.chrome.badge.text}
                shadowColor={tabChrome.border}
            >
                <NativeTabs.Trigger name="search">
                    <NativeTabs.Trigger.Label>{safeLabel(t('explore'), 'Explore')}</NativeTabs.Trigger.Label>
                    <NativeTabs.Trigger.Icon
                        src={{
                            default: require('../../../assets/icon/phosphor/compass-bold.png'),
                            selected: require('../../../assets/icon/phosphor/compass-fill.png'),
                        }}
                        renderingMode="template"
                    />
                </NativeTabs.Trigger>

                <NativeTabs.Trigger name="messages">
                    <NativeTabs.Trigger.Label>{safeLabel(t('messages'), 'Messages')}</NativeTabs.Trigger.Label>
                    <NativeTabs.Trigger.Icon
                        src={{
                            default: require('../../../assets/icon/phosphor/paper-plane-tilt-bold.png'),
                            selected: require('../../../assets/icon/phosphor/paper-plane-tilt-fill.png'),
                        }}
                        renderingMode="template"
                    />
                    {unreadCount > 0 ? (
                        <NativeTabs.Trigger.Badge>{formatBadgeCount(unreadCount)}</NativeTabs.Trigger.Badge>
                    ) : null}
                </NativeTabs.Trigger>

                <NativeTabs.Trigger name="activities">
                    <NativeTabs.Trigger.Label>{safeLabel(t('activities'), 'Activities')}</NativeTabs.Trigger.Label>
                    <NativeTabs.Trigger.Icon
                        src={{
                            default: require('../../../assets/icon/phosphor/hourglass-bold.png'),
                            selected: require('../../../assets/icon/phosphor/hourglass-high-fill.png'),
                        }}
                        renderingMode="template"
                    />
                </NativeTabs.Trigger>

                <NativeTabs.Trigger name="profile">
                    <NativeTabs.Trigger.Label>{safeLabel(t('profile'), 'Profile')}</NativeTabs.Trigger.Label>
                    <NativeTabs.Trigger.Icon
                        src={Platform.OS === 'android'
                            ? TRANSPARENT_TAB_ICON
                            : profileAvatarUrl
                                ? { uri: profileAvatarUrl }
                                : require('../../../assets/icon/icon.png')}
                        renderingMode="original"
                    />
                    {Platform.OS !== 'android' && profileBadge ? (
                        <NativeTabs.Trigger.Badge>{profileBadge}</NativeTabs.Trigger.Badge>
                    ) : null}
                </NativeTabs.Trigger>
                </NativeTabs>
                {Platform.OS === 'android' ? (
                    <View
                        pointerEvents="none"
                        style={[
                            styles.androidTabBarTopBorder,
                            {
                                bottom: insets.bottom + ANDROID_TAB_BAR_CONTENT_HEIGHT,
                                backgroundColor: tabChrome.border,
                            },
                        ]}
                    />
                ) : null}
                {Platform.OS === 'android' ? (
                    <View
                        pointerEvents="none"
                        style={[
                            styles.androidProfileAvatar,
                            {
                                left: androidAvatarLeft,
                                bottom: androidAvatarBottom,
                                borderColor: tabChrome.inactive,
                                backgroundColor: tabChrome.background,
                            },
                        ]}
                    >
                        <User size={18} color={tabChrome.inactive} weight="bold" />
                        {profileAvatarUrl ? (
                            <Image
                                source={{ uri: profileAvatarUrl }}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                                transition={0}
                                style={StyleSheet.absoluteFill}
                            />
                        ) : null}
                    </View>
                ) : null}
                {Platform.OS === 'android' && profileBadge ? (
                    <View
                        pointerEvents="none"
                        style={[
                            styles.androidProfileBadge,
                            {
                                left: androidAvatarLeft + ANDROID_TAB_ICON_SIZE - 8,
                                bottom: androidAvatarBottom + ANDROID_TAB_ICON_SIZE - 10,
                                backgroundColor: colors.chrome.badge.background,
                            },
                        ]}
                    >
                        <NativeText
                            numberOfLines={1}
                            style={[styles.androidProfileBadgeText, { color: colors.chrome.badge.text }]}
                        >
                            {profileBadge}
                        </NativeText>
                    </View>
                ) : null}
            </View>
        </AppMenuProvider>
    );
}

const styles = StyleSheet.create({
    navigatorHost: {
        flex: 1,
    },
    androidProfileAvatar: {
        position: 'absolute',
        zIndex: 2,
        width: ANDROID_TAB_ICON_SIZE,
        height: ANDROID_TAB_ICON_SIZE,
        borderRadius: ANDROID_TAB_ICON_SIZE / 2,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    androidTabBarTopBorder: {
        position: 'absolute',
        zIndex: 1,
        right: 0,
        left: 0,
        height: StyleSheet.hairlineWidth,
    },
    androidProfileBadge: {
        position: 'absolute',
        zIndex: 3,
        minWidth: 22,
        height: 18,
        paddingHorizontal: 5,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    androidProfileBadgeText: {
        fontSize: 11,
        lineHeight: 14,
        fontWeight: '700',
        includeFontPadding: false,
    },
});
