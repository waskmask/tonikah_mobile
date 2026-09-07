import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Bookmark, Compass, History, Send, User } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Svg, { Circle } from 'react-native-svg';
import { Text } from '@/components/ui/Text';
import { UnreadBadge } from '@/components/ui/UnreadBadge';
import { useLanguage } from '@/hooks/useLanguage';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';
import { chatService } from '@/lib/chatService';
import { profileService } from '@/lib/profileService';
import { Typography } from '@/constants/typography';
import { useHaptics } from '@/hooks/useHaptics';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { NavigationTypeTokens } from '@/constants/uiTokens';
import { completeInteraction, markInteraction } from '@/lib/performanceDiagnostics';

const ACTIVE_STROKE = 2;
const INACTIVE_STROKE = 1.8;

/** #RRGGBB -> #RRGGBBAA; anything else returned untouched. */
function hexWithAlpha(color: string, alpha: number) {
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return color;
    const channel = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
        .toString(16)
        .padStart(2, '0');
    return `${color}${channel}`;
}

type TabRoute = {
    name: string;
    labelKey: string;
    fallback: string;
    Icon: LucideIcon;
};

const TAB_ROUTES: TabRoute[] = [
    { name: 'search', labelKey: 'explore', fallback: 'Explore', Icon: Compass },
    { name: 'messages', labelKey: 'messages', fallback: 'Messages', Icon: Send },
    { name: 'favourited', labelKey: 'favourited', fallback: 'Saved', Icon: Bookmark },
    { name: 'activities', labelKey: 'activities', fallback: 'Activity', Icon: History },
    { name: 'profile', labelKey: 'profile', fallback: 'Me', Icon: User },
];

const VISIBLE_ROUTE_NAMES = new Set(TAB_ROUTES.map((item) => item.name));

function safeLabel(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function unreadFromResponse(value: any) {
    return Number(value?.unreadCount ?? value?.count ?? value?.data?.unreadCount ?? value?.data?.count ?? 0) || 0;
}

type MySummary = {
    avatarThumbUrl: string;
    completionPercent: number;
};

/** Me tab: the user's avatar inside a ring that fills with profile
    completion — a quiet, permanent nudge to finish the profile. */
function AvatarTabIcon({
    uri,
    percent,
    active,
    ringColor,
    trackColor,
}: {
    uri: string;
    percent: number;
    active: boolean;
    ringColor: string;
    trackColor: string;
}) {
    const box = scale(27);
    const strokeWidth = 2;
    const radius = (box - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.min(100, Math.max(0, percent));
    const avatarSize = box - scale(7);

    return (
        <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={box} height={box} style={StyleSheet.absoluteFill}>
                <Circle
                    cx={box / 2}
                    cy={box / 2}
                    r={radius}
                    stroke={trackColor}
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                <Circle
                    cx={box / 2}
                    cy={box / 2}
                    r={radius}
                    stroke={ringColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${circumference}`}
                    strokeDashoffset={circumference * (1 - clamped / 100)}
                    strokeLinecap="round"
                    fill="none"
                    // Progress starts at 12 o'clock
                    transform={`rotate(-90 ${box / 2} ${box / 2})`}
                />
            </Svg>
            <Image
                source={{ uri }}
                style={{
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: avatarSize / 2,
                    opacity: active ? 1 : 0.88,
                }}
                contentFit="cover"
            />
        </View>
    );
}

export function BottomTabBar({ state, descriptors, navigation }: any) {
    const colors = useColors();
    const tabChrome = colors.chrome.tabBar;
    const { currentLanguage, t, isRTL } = useLanguage();
    const insets = useSafeAreaInsets();
    const { lightImpact } = useHaptics();
    const [pendingRoute, setPendingRoute] = useState<string | null>(null);
    // Spinner only appears when a tab switch takes noticeably long; instant
    // switches keep the icon so there is no one-frame spinner flash.
    const [spinnerRoute, setSpinnerRoute] = useState<string | null>(null);
    const spinnerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activeRouteName = state.routes[state.index]?.name;
    const queryClient = useQueryClient();
    const { data: unreadCount = 0 } = useQuery({
        queryKey: queryKeys.chat.unreadCount,
        queryFn: async () => unreadFromResponse(await chatService.unreadCount()),
        staleTime: 15_000,
    });
    const { data: mySummary = null } = useQuery<MySummary | null>({
        queryKey: queryKeys.profile.mySummary,
        queryFn: async () => {
            const res = await profileService.fetchMySummary();
            const summaryUser = res?.user;
            if (!res?.success || !summaryUser) return null;
            return {
                avatarThumbUrl: String(summaryUser.avatarThumbUrl || summaryUser.avatarUrl || ''),
                completionPercent: Number(summaryUser.completionPercent) || 0,
            };
        },
        staleTime: 60_000,
    });

    useEffect(() => {
        if (activeRouteName === 'profile') {
            void queryClient.invalidateQueries({ queryKey: queryKeys.profile.mySummary });
        }
    }, [activeRouteName, queryClient]);

    useEffect(() => {
        if (activeRouteName) completeInteraction(`tab:${activeRouteName}`, 'active');
        setPendingRoute(null);
        setSpinnerRoute(null);
        if (spinnerTimerRef.current) {
            clearTimeout(spinnerTimerRef.current);
            spinnerTimerRef.current = null;
        }
    }, [activeRouteName]);

    useEffect(() => () => {
        if (spinnerTimerRef.current) clearTimeout(spinnerTimerRef.current);
    }, []);

    const handleUnread = useCallback((payload: any) => {
        queryClient.setQueryData(queryKeys.chat.unreadCount, unreadFromResponse(payload));
    }, [queryClient]);

    useChatSocket({
        enabled: true,
        onUnread: handleUnread,
    });

    const visibleRoutes = useMemo(
        () => TAB_ROUTES.map((item) => {
            const route = state.routes.find((candidate: any) => candidate.name === item.name);
            return route ? { ...item, route } : null;
        }).filter(Boolean) as Array<TabRoute & { route: any }>,
        [state.routes],
    );

    if (!VISIBLE_ROUTE_NAMES.has(activeRouteName)) return null;

    return (
        <View
            style={[
                styles.container,
                {
                    paddingBottom: Math.max(insets.bottom, scale(8)),
                    backgroundColor: tabChrome.background,
                    borderTopColor: tabChrome.border,
                    shadowColor: colors.chrome.common.shadow,
                },
            ]}
        >
            <View style={[styles.inner, { flexDirection: 'row' }]}>
                {visibleRoutes.map((item) => {
                    const options = descriptors[item.route.key]?.options || {};
                    const isFocused = activeRouteName === item.name;
                    const pending = pendingRoute === item.name;
                    const isActive = isFocused || pending;
                    const label = safeLabel(t(item.labelKey), item.fallback);
                    const color = isActive ? tabChrome.active : tabChrome.inactive;
                    const badge = item.name === 'messages' ? unreadCount : 0;
                    const labelFontFamily = currentLanguage === 'ar'
                        ? (isActive ? Typography.font.arabic.bold : Typography.font.arabic.semi)
                        : (isActive ? Typography.font.body.semi : Typography.font.body.medium);
                    const fill = isFocused && item.name === 'favourited' ? color : 'transparent';

                    function onPress() {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: item.route.key,
                            canPreventDefault: true,
                        });

                        if (isFocused || event.defaultPrevented) return;
                        lightImpact();
                        markInteraction(`tab:${item.name}`);
                        setPendingRoute(item.name);
                        if (spinnerTimerRef.current) clearTimeout(spinnerTimerRef.current);
                        spinnerTimerRef.current = setTimeout(() => setSpinnerRoute(item.name), 250);
                        navigation.navigate(item.route.name, item.route.params);
                    }

                    return (
                        <Pressable
                            key={item.name}
                            accessibilityRole="button"
                            accessibilityState={isFocused ? { selected: true } : undefined}
                            accessibilityLabel={options.tabBarAccessibilityLabel || label}
                            onPress={onPress}
                            style={({ pressed }) => [
                                styles.item,
                                pressed && styles.itemPressed,
                            ]}
                        >
                            <View style={styles.iconSlot}>
                                <View style={styles.iconWrap}>
                                    {spinnerRoute === item.name && !isFocused ? (
                                        <ActivityIndicator size="small" color={color} />
                                    ) : item.name === 'profile' && mySummary?.avatarThumbUrl ? (
                                        <AvatarTabIcon
                                            uri={mySummary.avatarThumbUrl}
                                            percent={mySummary.completionPercent}
                                            active={isActive}
                                            ringColor={tabChrome.active}
                                            trackColor={hexWithAlpha(tabChrome.inactive, 0.3)}
                                        />
                                    ) : (
                                        <item.Icon
                                            size={scale(23)}
                                            color={color}
                                            strokeWidth={isActive ? ACTIVE_STROKE : INACTIVE_STROKE}
                                            fill={fill}
                                        />
                                    )}
                                    {badge > 0 ? (
                                        <UnreadBadge
                                            count={badge}
                                            variant="sm"
                                            borderColor={tabChrome.background}
                                            style={styles.tabBadge}
                                        />
                                    ) : null}
                                </View>
                            </View>
                            <View style={styles.labelWrap}>
                                <Text
                                    variant="caption"
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                    allowFontScaling={false}
                                    style={[
                                        styles.label,
                                        {
                                            color,
                                            // Fixed size (not scale()) so labels render identically on
                                            // every device
                                            ...NavigationTypeTokens.tabLabel,
                                            fontFamily: labelFontFamily,
                                        },
                                    ]}
                                >
                                    {label}
                                </Text>
                            </View>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingTop: 5,
        paddingHorizontal: scale(16),
        shadowOpacity: 0.06,
        shadowRadius: scale(16),
        shadowOffset: { width: 0, height: -3 },
        elevation: 10,
    },
    inner: {
        width: '100%',
        maxWidth: 640,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
    },
    item: {
        flex: 1,
        flexBasis: 0,
        minWidth: 0,
        minHeight: scale(52),
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(5) + 2,
        paddingHorizontal: 0,
    },
    itemPressed: {
        opacity: 0.82,
        transform: [{ scale: 0.96 }],
    },
    iconSlot: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: scale(28),
        width: '100%',
        maxWidth: scale(62),
    },
    iconWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: scale(28),
        minHeight: scale(28),
        maxWidth: scale(62),
    },
    tabBadge: {
        position: 'absolute',
        top: -scale(5),
        right: -scale(9),
    },
    labelWrap: {
        width: '100%',
        minWidth: 0,
        maxWidth: scale(62),
        paddingHorizontal: 0,
    },
    label: {
        width: '100%',
        textAlign: 'center',
        includeFontPadding: false,
    },
});
