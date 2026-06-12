import React from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Ban,
    CreditCard,
    Handshake,
    Languages,
    LifeBuoy,
    LogOut,
    Monitor,
    Moon,
    PencilLine,
    Settings,
    Sparkles,
    Sun,
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

type MenuItem = {
    href: Href;
    labelKey: string;
    fallback: string;
    icon: LucideIcon;
};

const QUICK_ITEMS: MenuItem[] = [
    { href: '/(tabs)/my-hobbies', labelKey: 'hobbies', fallback: 'Hobbies', icon: Sparkles },
    { href: '/(tabs)/faith', labelKey: 'faith', fallback: 'Faith', icon: Moon },
    { href: '/(tabs)/partner-preference', labelKey: 'partner_preference', fallback: 'Partner Preference', icon: Handshake },
    { href: '/(tabs)/language', labelKey: 'language', fallback: 'Language', icon: Languages },
];

const ACCOUNT_ITEMS: MenuItem[] = [
    { href: '/(tabs)/edit-profile', labelKey: 'edit_profile', fallback: 'Edit profile', icon: PencilLine },
    { href: '/(tabs)/memberships', labelKey: 'memberships', fallback: 'Memberships', icon: CreditCard },
    { href: '/(tabs)/blocked-users', labelKey: 'blocked_users', fallback: 'Blocked users', icon: Ban },
    { href: '/support', labelKey: 'report_issue', fallback: 'Report an issue', icon: LifeBuoy },
    { href: '/(tabs)/settings', labelKey: 'settings', fallback: 'Settings', icon: Settings },
];

const DRAWER_WIDTH = Dimensions.get('window').width;

function textValue(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function AppMenuDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const { t, isRTL } = useLanguage();
    const { isDark, theme, setTheme } = useTheme();
    const { logout, isLoading } = useAuthStore();

    const surfaceColor = isDark ? '#111827' : '#FFFFFF';
    const borderColor = isDark ? '#334155' : '#E8E8E6';
    const headingColor = isDark ? '#E2E8F0' : '#25322B';
    const mutedColor = isDark ? '#94A3B8' : '#6F746F';
    const overlayColor = isDark ? 'rgba(2, 6, 23, 0.58)' : 'rgba(15, 23, 42, 0.45)';

    const navigate = (href: Href) => {
        onClose();
        router.push(href);
    };

    const handleLogout = async () => {
        onClose();
        await logout();
        router.replace('/(auth)/login');
    };

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
            <View style={styles.modalRoot}>
                <Pressable style={[styles.overlay, { backgroundColor: overlayColor }]} onPress={onClose} />
                <SafeAreaView
                    edges={['top', 'bottom']}
                    style={[
                        styles.drawer,
                        {
                            width: DRAWER_WIDTH,
                            backgroundColor: surfaceColor,
                            borderColor,
                        },
                    ]}
                >
                    <View style={[styles.header, { borderBottomColor: borderColor, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <Text
                            variant="body"
                            className="font-body-semi"
                            style={[styles.headerTitle, { color: headingColor, textAlign: isRTL ? 'right' : 'left' }]}
                        >
                            {textValue(t('menu'), 'Menu')}
                        </Text>
                        <Pressable onPress={onClose} style={styles.closeButton} hitSlop={10}>
                            <X size={24} color={headingColor} strokeWidth={2.1} />
                        </Pressable>
                    </View>

                    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                        <MenuRow
                            icon={User}
                            label={textValue(t('my_profile'), 'My profile')}
                            onPress={() => navigate('/(tabs)/profile')}
                        />

                        {QUICK_ITEMS.map((item) => (
                            <MenuRow
                                key={String(item.href)}
                                icon={item.icon}
                                label={textValue(t(item.labelKey), item.fallback)}
                                onPress={() => navigate(item.href)}
                            />
                        ))}

                        {ACCOUNT_ITEMS.map((item) => (
                            <MenuRow
                                key={String(item.href)}
                                icon={item.icon}
                                label={textValue(t(item.labelKey), item.fallback)}
                                onPress={() => navigate(item.href)}
                            />
                        ))}
                    </ScrollView>

                    <View style={[styles.footer, { borderTopColor: borderColor }]}>
                        <View style={[styles.themeRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                            <Text variant="body-sm" className="font-body-semi" style={[styles.themeLabel, { color: mutedColor }]}>
                                {textValue(t('theme'), 'Theme')}
                            </Text>
                            <View style={[styles.themeSegment, { backgroundColor: isDark ? '#1E293B' : '#F3F3F1', flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                                <ThemeButton active={theme === 'light'} icon={Sun} onPress={() => setTheme('light')} />
                                <ThemeButton active={theme === 'dark'} icon={Moon} onPress={() => setTheme('dark')} />
                                <ThemeButton active={theme === 'system'} icon={Monitor} onPress={() => setTheme('system')} />
                            </View>
                        </View>
                        <MenuRow
                            icon={LogOut}
                            label={isLoading ? textValue(t('please_wait'), 'Please wait') : textValue(t('logout'), 'Logout')}
                            danger
                            onPress={handleLogout}
                        />
                    </View>
                </SafeAreaView>
            </View>
        </Modal>
    );
}

function ThemeButton({ active, icon: Icon, onPress }: { active: boolean; icon: LucideIcon; onPress: () => void }) {
    const { isDark } = useTheme();
    const iconColor = active ? (isDark ? '#E2E8F0' : '#25322B') : isDark ? '#94A3B8' : '#6F746F';

    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.themeButton,
                active && {
                    backgroundColor: isDark ? '#334155' : '#FFFFFF',
                    shadowColor: '#000000',
                    shadowOpacity: isDark ? 0 : 0.08,
                    shadowRadius: scale(8),
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 2,
                },
            ]}
        >
            <Icon size={scale(18)} color={iconColor} strokeWidth={1.9} />
        </Pressable>
    );
}

function MenuRow({
    icon: Icon,
    label,
    onPress,
    danger = false,
}: {
    icon: LucideIcon;
    label: string;
    onPress: () => void;
    danger?: boolean;
}) {
    const { isDark } = useTheme();
    const { currentLanguage, isRTL } = useLanguage();
    const color = danger ? '#E64E67' : isDark ? '#E2E8F0' : '#25322B';
    const fontFamily = currentLanguage === 'ar' ? Typography.font.arabic.bold : Typography.font.body.semi;

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.menuRow,
                pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(37,50,43,0.04)' },
            ]}
        >
            <View style={[styles.rowContent, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={[styles.iconSlot, isRTL ? styles.iconSlotRtl : styles.iconSlotLtr]}>
                    <Icon size={20} color={color} strokeWidth={1.85} />
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
    drawer: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
    },
    header: {
        minHeight: scale(58),
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: scale(14),
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        lineHeight: 24,
    },
    closeButton: {
        width: scale(42),
        height: scale(42),
        borderRadius: scale(21),
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
        fontSize: 16,
        lineHeight: 22,
    },
    footer: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: scale(24),
        paddingTop: scale(16),
        paddingBottom: scale(18),
    },
    themeRow: {
        minHeight: scale(50),
        alignItems: 'center',
        gap: scale(12),
        marginBottom: scale(8),
    },
    themeLabel: {
        flex: 1,
        fontSize: 14,
        lineHeight: 18,
    },
    themeSegment: {
        borderRadius: scale(999),
        padding: scale(4),
        alignItems: 'center',
        gap: scale(2),
    },
    themeButton: {
        width: scale(36),
        height: scale(36),
        borderRadius: scale(18),
        alignItems: 'center',
        justifyContent: 'center',
    },
});
