import React, { useEffect } from 'react';
import { ActivityIndicator, Dimensions, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, type Href, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Ban,
    BookHeart,
    CreditCard,
    Handshake,
    Languages,
    LifeBuoy,
    LogOut,
    PencilLine,
    Settings,
    Sparkles,
    User,
    X,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { useAuthStore } from '@/store/authStore';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';
import { Typography } from '@/constants/typography';
import { NavigationTypeTokens } from '@/constants/uiTokens';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { completeInteraction } from '@/lib/performanceDiagnostics';

type MenuItem = {
    href: Href;
    labelKey: string;
    fallback: string;
    icon: LucideIcon;
};

const QUICK_ITEMS: MenuItem[] = [
    { href: '/(tabs)/my-hobbies', labelKey: 'hobbies', fallback: 'Hobbies', icon: Sparkles },
    { href: '/(tabs)/faith', labelKey: 'faith_in_daily_life', fallback: 'Faith in Daily Life', icon: BookHeart },
    { href: '/(tabs)/partner-preference', labelKey: 'partner_preference', fallback: 'Partner Preference', icon: Handshake },
    { href: '/(tabs)/language', labelKey: 'language', fallback: 'Language', icon: Languages },
];

const ACCOUNT_ITEMS: MenuItem[] = [
    { href: '/(tabs)/edit-profile', labelKey: 'edit_profile', fallback: 'Edit profile', icon: PencilLine },
    { href: '/(tabs)/memberships', labelKey: 'memberships', fallback: 'Memberships', icon: CreditCard },
    { href: { pathname: '/(tabs)/activities', params: { tab: 'blocked' } }, labelKey: 'blocked_users', fallback: 'Blocked users', icon: Ban },
    { href: '/support', labelKey: 'report_issue', fallback: 'Report an issue', icon: LifeBuoy },
    { href: '/(tabs)/settings', labelKey: 'settings', fallback: 'Settings', icon: Settings },
];

const DRAWER_WIDTH = Dimensions.get('window').width;
const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);

function textValue(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function AppMenuDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const { t, isRTL } = useLanguage();
    const { isDark } = useTheme();
    const { logout, isLoading } = useAuthStore();
    const pathname = usePathname();
    const reduceMotion = useReducedMotion();
    const progress = useSharedValue(0);

    useEffect(() => {
        if (!visible) return;
        progress.value = reduceMotion ? 1 : 0;
        if (!reduceMotion) {
            progress.value = withTiming(1, {
                duration: 180,
                easing: Easing.out(Easing.cubic),
            });
        }
    }, [progress, reduceMotion, visible]);

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: progress.value,
    }));
    const drawerStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: (1 - progress.value) * DRAWER_WIDTH * (isRTL ? -1 : 1) }],
    }));

    const surfaceColor = isDark ? '#1B1713' : '#FFFFFF';
    const borderColor = isDark ? '#3A332B' : '#E8E8E6';
    const headingColor = isDark ? '#E8E1D6' : '#241E17';
    const overlayColor = isDark ? 'rgba(2, 6, 23, 0.58)' : 'rgba(24, 19, 14, 0.45)';

    const navigate = (href: Href) => {
        if (isLoading) return;
        onClose();
        requestAnimationFrame(() => {
            if (href === '/(tabs)/edit-profile') {
                router.push({
                    pathname: '/(tabs)/edit-profile',
                    params: { returnTo: pathname },
                });
                return;
            }
            router.push(href);
        });
    };

    const handleLogout = async () => {
        if (isLoading) return;
        await logout();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            onShow={() => completeInteraction('drawer', 'visible')}
            onRequestClose={() => {
                if (!isLoading) onClose();
            }}
        >
            <View style={styles.modalRoot}>
                <Animated.View style={[styles.overlay, { backgroundColor: overlayColor }, overlayStyle]}>
                    <Pressable style={styles.overlayPressable} onPress={onClose} disabled={isLoading} />
                </Animated.View>
                <AnimatedSafeAreaView
                    edges={['top', 'bottom']}
                    style={[
                        styles.drawer,
                        drawerStyle,
                        {
                            width: DRAWER_WIDTH,
                            backgroundColor: surfaceColor,
                            borderColor,
                            left: isRTL ? 0 : undefined,
                            right: isRTL ? undefined : 0,
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
                            label={textValue(t('my_profile'), 'My profile')}
                            disabled={isLoading}
                            onPress={() => navigate('/(tabs)/profile')}
                        />

                        {QUICK_ITEMS.map((item) => (
                            <MenuRow
                                key={item.labelKey}
                                icon={item.icon}
                                label={textValue(t(item.labelKey), item.fallback)}
                                disabled={isLoading}
                                onPress={() => navigate(item.href)}
                            />
                        ))}

                        {ACCOUNT_ITEMS.map((item) => (
                            <MenuRow
                                key={item.labelKey}
                                icon={item.icon}
                                label={textValue(t(item.labelKey), item.fallback)}
                                disabled={isLoading}
                                onPress={() => navigate(item.href)}
                            />
                        ))}
                    </ScrollView>

                    <View style={[styles.footer, { borderTopColor: borderColor }]}>
                        <MenuRow
                            icon={LogOut}
                            label={isLoading ? textValue(t('please_wait'), 'Please wait') : textValue(t('logout'), 'Logout')}
                            danger
                            disabled={isLoading}
                            loading={isLoading}
                            onPress={handleLogout}
                        />
                    </View>
                </AnimatedSafeAreaView>
            </View>
        </Modal>
    );
}

function MenuRow({
    icon: Icon,
    label,
    onPress,
    danger = false,
    disabled = false,
    loading = false,
}: {
    icon: LucideIcon;
    label: string;
    onPress: () => void;
    danger?: boolean;
    disabled?: boolean;
    loading?: boolean;
}) {
    const { isDark } = useTheme();
    const { currentLanguage, isRTL } = useLanguage();
    const color = danger ? '#E64E67' : isDark ? '#E8E1D6' : '#241E17';
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
                        <Icon size={20} color={color} strokeWidth={1.85} />
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
    modalRoot: {
        flex: 1,
    },
    overlay: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
    },
    overlayPressable: {
        flex: 1,
    },
    drawer: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
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
