import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, type Href, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withTiming,
} from 'react-native-reanimated';
import {
    PencilLine,
    X,
} from '@/components/ui/icons/PhosphorCompat';
import {
    CreditCard,
    GearSix,
    HandHeart,
    Plant,
    Prohibit,
    ShieldWarning,
    SignOut,
    Translate,
    User,
    type Icon as PhosphorIcon,
    type IconWeight,
} from 'phosphor-react-native';
import { Text } from '@/components/ui/Text';
import { useAuthStore } from '@/store/authStore';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { useWebSupport } from '@/hooks/useWebSupport';
import { scale } from '@/hooks/useResponsive';
import { Typography } from '@/constants/typography';
import { NavigationTypeTokens } from '@/constants/uiTokens';

type MenuItemBase = {
    labelKey: string;
    fallback: string;
    icon: PhosphorIcon;
    iconWeight?: IconWeight;
};

type MenuItem = MenuItemBase & (
    | { href: Href; action?: never }
    | { action: 'support'; href?: never }
);

const QUICK_ITEMS: MenuItem[] = [
    { href: '/hobbies-faith', labelKey: 'hobbies_and_faith', fallback: 'Hobbies & Faith', icon: Plant, iconWeight: 'bold' },
    { href: '/partner-preference', labelKey: 'partner_preference', fallback: 'Partner Preference', icon: HandHeart, iconWeight: 'bold' },
    { href: '/language', labelKey: 'language', fallback: 'Language', icon: Translate, iconWeight: 'bold' },
];

const ACCOUNT_ITEMS: MenuItem[] = [
    { href: '/(tabs)/profile', labelKey: 'edit_profile', fallback: 'Edit profile', icon: PencilLine },
    { href: '/memberships', labelKey: 'memberships', fallback: 'Memberships', icon: CreditCard, iconWeight: 'bold' },
    { href: '/blocked-users', labelKey: 'blocked_users', fallback: 'Blocked users', icon: Prohibit, iconWeight: 'bold' },
    { action: 'support', labelKey: 'report_issue', fallback: 'Report an issue', icon: ShieldWarning, iconWeight: 'bold' },
    { href: '/settings', labelKey: 'settings', fallback: 'Settings', icon: GearSix, iconWeight: 'bold' },
];

function textValue(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

const DRAWER_FADE_DELAY_MS = 100;
const DRAWER_FADE_DURATION_MS = 55;
const DRAWER_NAVIGATION_DELAY_MS = 115;
const DRAWER_RESET_DELAY_MS = 300;
const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);

export function AppMenuDrawerContent({
    onClose,
    isOpen = true,
}: {
    onClose: () => void;
    isOpen?: boolean;
}) {
    const { t, isRTL } = useLanguage();
    const { isDark } = useTheme();
    const { logout, isLoading } = useAuthStore();
    const openSupport = useWebSupport();
    const pathname = usePathname();
    const reduceMotion = useReducedMotion();
    const opacity = useSharedValue(1);
    const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [transitioning, setTransitioning] = useState(false);
    const surfaceColor = isDark ? '#1D1D1F' : '#FFFFFF';
    const borderColor = isDark ? '#303033' : '#EEEEEE';
    const headingColor = isDark ? '#E5E5E7' : '#241E17';

    useEffect(() => {
        if (!isOpen) return;
        if (navigationTimerRef.current) {
            clearTimeout(navigationTimerRef.current);
            navigationTimerRef.current = null;
        }
        if (resetTimerRef.current) {
            clearTimeout(resetTimerRef.current);
            resetTimerRef.current = null;
        }
        opacity.value = 1;
        setTransitioning(false);
    }, [isOpen, opacity]);

    useEffect(() => () => {
        if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    }, []);

    const contentStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

    const openDestination = (href: Href) => {
        if (href === '/hobbies-faith') {
            router.push({
                pathname: '/hobbies-faith',
                params: { returnTo: pathname },
            });
            return;
        }
        if (href === '/partner-preference') {
            router.push({
                pathname: '/partner-preference',
                params: { returnTo: pathname },
            });
            return;
        }
        router.push(href);
    };

    const closeThenRun = (action: () => void) => {
        if (isLoading || transitioning) return;
        if (reduceMotion) {
            onClose();
            action();
            return;
        }

        setTransitioning(true);
        onClose();
        opacity.value = withDelay(
            DRAWER_FADE_DELAY_MS,
            withTiming(0, { duration: DRAWER_FADE_DURATION_MS }),
        );
        navigationTimerRef.current = setTimeout(() => {
            navigationTimerRef.current = null;
            action();
        }, DRAWER_NAVIGATION_DELAY_MS);
        resetTimerRef.current = setTimeout(() => {
            resetTimerRef.current = null;
            opacity.value = 1;
            setTransitioning(false);
        }, DRAWER_RESET_DELAY_MS);
    };

    const navigate = (href: Href) => closeThenRun(() => openDestination(href));
    const navigateToSupport = () => closeThenRun(() => void openSupport());

    const handleLogout = async () => {
        if (isLoading) return;
        await logout();
    };

    return (
        <AnimatedSafeAreaView
            edges={['top', 'bottom']}
            pointerEvents={transitioning ? 'none' : 'auto'}
            style={[
                styles.drawer,
                contentStyle,
                {
                    backgroundColor: surfaceColor,
                    borderColor,
                    borderLeftWidth: isRTL ? 0 : StyleSheet.hairlineWidth,
                    borderRightWidth: isRTL ? StyleSheet.hairlineWidth : 0,
                },
            ]}
        >
            <View style={[styles.header, { borderBottomColor: borderColor, flexDirection: 'row' }]}>
                <Text
                    variant="body-sm"
                    className="font-body-bold"
                    style={[styles.headerTitle, { color: headingColor, textAlign: isRTL ? 'right' : 'left' }]}
                >
                    {textValue(t('menu'), 'Menu')}
                </Text>
                <Pressable onPress={onClose} disabled={isLoading} style={styles.closeButton} hitSlop={10}>
                    <X size={24} color={headingColor} strokeWidth={2.1} />
                </Pressable>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <MenuRow
                    icon={User}
                    iconWeight="bold"
                    label={textValue(t('my_profile'), 'My profile')}
                    disabled={isLoading}
                    onPress={() => navigate('/(tabs)/profile')}
                />

                {QUICK_ITEMS.map((item) => (
                    <MenuRow
                        key={item.labelKey}
                        icon={item.icon}
                        iconWeight={item.iconWeight}
                        label={textValue(t(item.labelKey), item.fallback)}
                        disabled={isLoading}
                        onPress={() => item.action === 'support' ? navigateToSupport() : navigate(item.href)}
                    />
                ))}

                {ACCOUNT_ITEMS.map((item) => (
                    <MenuRow
                        key={item.labelKey}
                        icon={item.icon}
                        iconWeight={item.iconWeight}
                        label={textValue(t(item.labelKey), item.fallback)}
                        disabled={isLoading}
                        onPress={() => item.action === 'support' ? navigateToSupport() : navigate(item.href)}
                    />
                ))}
            </ScrollView>

            <View style={[styles.footer, { borderTopColor: borderColor }]}>
                <MenuRow
                    icon={SignOut}
                    iconWeight="bold"
                    label={isLoading ? textValue(t('please_wait'), 'Please wait') : textValue(t('logout'), 'Logout')}
                    danger
                    disabled={isLoading}
                    loading={isLoading}
                    onPress={handleLogout}
                />
            </View>
        </AnimatedSafeAreaView>
    );
}

function MenuRow({
    icon: Icon,
    iconWeight,
    label,
    onPress,
    danger = false,
    disabled = false,
    loading = false,
}: {
    icon: PhosphorIcon;
    iconWeight?: IconWeight;
    label: string;
    onPress: () => void;
    danger?: boolean;
    disabled?: boolean;
    loading?: boolean;
}) {
    const { isDark } = useTheme();
    const { currentLanguage, isRTL } = useLanguage();
    const color = danger ? '#E64E67' : isDark ? '#E5E5E7' : '#241E17';
    const fontFamily = currentLanguage === 'ar' ? Typography.font.arabic.bold : Typography.font.body.semi;

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled, busy: loading }}
            style={({ pressed }) => [
                styles.menuRow,
                pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(37,50,43,0.04)' },
            ]}
        >
            <View style={[styles.rowContent, { flexDirection: 'row' }]}>
                <View style={[styles.iconSlot, isRTL ? styles.iconSlotRtl : styles.iconSlotLtr]}>
                    {loading ? (
                        <ActivityIndicator size="small" color={color} />
                    ) : (
                        <Icon size={20} color={color} weight={iconWeight || 'regular'} />
                    )}
                </View>
                <Text
                    variant="body"
                    numberOfLines={1}
                    className="font-body-semi"
                    style={[styles.menuLabel, { color, fontFamily, textAlign: isRTL ? 'right' : 'left' }]}
                >
                    {label}
                </Text>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    drawer: {
        flex: 1,
    },
    header: {
        height: scale(50),
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: scale(14),
    },
    headerTitle: {
        flex: 1,
        ...NavigationTypeTokens.drawerTitle,
    },
    closeButton: {
        width: scale(34),
        height: scale(34),
        borderRadius: scale(17),
        alignItems: 'center',
        justifyContent: 'center',
    },
    scroll: {
        flex: 1,
    },
    content: {
        paddingHorizontal: scale(24),
        paddingTop: scale(8),
        paddingBottom: scale(18),
    },
    menuRow: {
        minHeight: 58,
        justifyContent: 'center',
        borderRadius: scale(10),
    },
    rowContent: {
        alignItems: 'center',
        width: '100%',
        minHeight: 58,
    },
    iconSlot: {
        width: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconSlotLtr: {
        marginRight: 18,
    },
    iconSlotRtl: {
        marginLeft: 18,
    },
    menuLabel: {
        flex: 1,
        ...NavigationTypeTokens.drawerLabel,
    },
    footer: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: scale(24),
        paddingTop: scale(8),
        paddingBottom: scale(18),
    },
});
