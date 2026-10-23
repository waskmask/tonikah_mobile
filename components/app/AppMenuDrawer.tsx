import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, type Href, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    SealCheck,
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
import { fontFamilyForText } from '@/constants/typography';
import { NavigationTypeTokens } from '@/constants/uiTokens';
import { MEMBERSHIP_PURCHASES_ENABLED } from '@/constants/releaseFeatures';

type MenuItemBase = {
    labelKey: string;
    fallback: string;
    icon: PhosphorIcon;
    iconWeight?: IconWeight;
    iconElement?: React.ReactNode;
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
    { href: '/profile', labelKey: 'edit_profile', fallback: 'Edit profile', icon: PencilLine },
    { href: '/memberships', labelKey: 'memberships', fallback: 'Memberships', icon: CreditCard, iconWeight: 'bold' },
    { href: '/verifications', labelKey: 'get_verified', fallback: 'Get verified', icon: SealCheck,
        iconElement: <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
            <SealCheck size={22} color="#F34B6F" weight="fill" />
            <SealCheck size={24} color="#FFFFFF" weight="light" style={{ position: 'absolute' }} />
        </View> },
    { href: '/blocked-users', labelKey: 'blocked_users', fallback: 'Blocked users', icon: Prohibit, iconWeight: 'bold' },
    { action: 'support', labelKey: 'report_issue', fallback: 'Report an issue', icon: ShieldWarning, iconWeight: 'bold' },
    { href: '/settings', labelKey: 'settings', fallback: 'Settings', icon: GearSix, iconWeight: 'bold' },
];

function textValue(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function AppMenuDrawerContent({
    onClose,
    onCloseThenRun,
    isNavigating = false,
}: {
    onClose: () => void;
    onCloseThenRun: (action: () => void, destination?: string) => void;
    isNavigating?: boolean;
}) {
    const { t, isRTL } = useLanguage();
    const { isDark } = useTheme();
    const { logout, isLoading } = useAuthStore();
    const openSupport = useWebSupport();
    const pathname = usePathname();
    const surfaceColor = isDark ? '#1D1D1F' : '#FFFFFF';
    const borderColor = isDark ? '#303033' : '#EEEEEE';
    const headingColor = isDark ? '#E5E5E7' : '#241E17';

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
        if (href === '/language') {
            router.push({
                pathname: '/language',
                params: { returnTo: pathname },
            });
            return;
        }
        router.push(href);
    };

    const closeThenRun = (action: () => void, destination?: string) => {
        if (isLoading || isNavigating) return;
        onCloseThenRun(action, destination);
    };

    const navigate = (href: Href) => closeThenRun(() => openDestination(href), typeof href === 'string' ? href : href.pathname);
    const navigateToSupport = () => closeThenRun(() => void openSupport());

    const handleLogout = async () => {
        if (isLoading) return;
        closeThenRun(() => { void logout(); });
    };

    return (
        <SafeAreaView
            edges={['top', 'bottom']}
            style={[
                styles.drawer,
                {
                    backgroundColor: surfaceColor,
                    direction: isRTL ? 'rtl' : 'ltr',
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
                    style={[styles.headerTitle, { color: headingColor, textAlign: 'left' }]}
                >
                    {textValue(t('menu'), 'Menu')}
                </Text>
                <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={textValue(t('close_menu'), 'Close menu')} style={styles.closeButton} hitSlop={10}>
                    <X size={24} color={headingColor} strokeWidth={2.1} />
                </Pressable>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <MenuRow
                    icon={User}
                    iconWeight="bold"
                    label={textValue(t('my_profile'), 'My profile')}
                    disabled={isLoading || isNavigating}
                    onPress={() => navigate('/profile')}
                />

                {QUICK_ITEMS.map((item) => (
                    <MenuRow
                        key={item.labelKey}
                        icon={item.icon}
                        iconWeight={item.iconWeight}
                        label={textValue(t(item.labelKey), item.fallback)}
                        disabled={isLoading || isNavigating}
                        onPress={() => item.action === 'support' ? navigateToSupport() : navigate(item.href)}
                    />
                ))}

                {ACCOUNT_ITEMS.filter((item) => MEMBERSHIP_PURCHASES_ENABLED || item.href !== '/memberships').map((item) => (
                    <MenuRow
                        key={item.labelKey}
                        iconElement={item.iconElement}
                        icon={item.icon}
                        iconWeight={item.iconWeight}
                        label={textValue(t(item.labelKey), item.fallback)}
                        disabled={isLoading || isNavigating}
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
                    disabled={isLoading || isNavigating}
                    loading={isLoading}
                    onPress={handleLogout}
                />
            </View>
        </SafeAreaView>
    );
}

function MenuRow({
    icon: Icon,
    iconWeight,
    iconElement,
    label,
    onPress,
    danger = false,
    disabled = false,
    loading = false,
}: {
    icon: PhosphorIcon;
    iconWeight?: IconWeight;
    iconElement?: React.ReactNode;
    label: string;
    onPress: () => void;
    danger?: boolean;
    disabled?: boolean;
    loading?: boolean;
}) {
    const { isDark } = useTheme();
    const { isRTL } = useLanguage();
    const color = danger ? '#E64E67' : isDark ? '#E5E5E7' : '#241E17';
    const fontFamily = fontFamilyForText(label, 'semi');

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
                        iconElement ?? <Icon size={20} color={color} weight={iconWeight || 'regular'} />
                    )}
                </View>
                <Text
                    variant="body"
                    numberOfLines={1}
                    className="font-body-semi"
                    style={[styles.menuLabel, { color, fontFamily, textAlign: 'left' }]}
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
