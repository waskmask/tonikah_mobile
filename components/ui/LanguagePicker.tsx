import React, { useState } from 'react';
import {
    View,
    Pressable,
    Modal,
    ScrollView,
    StyleSheet,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { usePathname } from 'expo-router';
import { Text } from './Text';
import { useLanguage } from '@/hooks/useLanguage';
import { useColors } from '@/hooks/useColors';
import { useHaptics } from '@/hooks/useHaptics';
import { scale } from '@/hooks/useResponsive';
import { ChevronDown, Check, Languages } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SUPPORTED_APP_LANGUAGES } from '@/lib/languageNames';

const LANGUAGES = SUPPORTED_APP_LANGUAGES;

type LanguagePickerProps = {
    variant?: 'default' | 'icon';
};

export function LanguagePicker({ variant = 'default' }: LanguagePickerProps) {
    const { currentLanguage, changeLanguage, t } = useLanguage();
    const pathname = usePathname();
    const colors = useColors();
    const { lightImpact } = useHaptics();
    const [visible, setVisible] = useState(false);

    const current = LANGUAGES.find(l => l.code === currentLanguage) || LANGUAGES[0];
    const isIcon = variant === 'icon';

    const handleSelect = async (code: string) => {
        setVisible(false);
        if (code !== currentLanguage) {
            await changeLanguage(code, pathname);
        }
    };

    const openPicker = () => {
        lightImpact();
        setVisible(true);
    };

    const iconChipBg = colors.brand.bg.surface;
    const iconChipBorder = colors.brand.bg.border;
    // header.icon: #5C5348 light / #D8CFC2 dark — darker than text.subtitle in light mode
    const iconColor = colors.chrome.header.icon;

    return (
        <>
            <Pressable
                onPress={openPicker}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={t('language', 'Language')}
                style={({ pressed }) => [
                    isIcon ? styles.iconTrigger : styles.trigger,
                    isIcon
                        ? {
                            backgroundColor: pressed ? colors.chrome.common.primaryTint : iconChipBg,
                            borderColor: iconChipBorder,
                        }
                        : {
                            backgroundColor: pressed
                                ? colors.chrome.common.primaryTint
                                : colors.brand.bg.surface,
                            borderColor: colors.brand.bg.border,
                        },
                ]}
            >
                {isIcon ? (
                    <Languages size={scale(18)} color={iconColor} strokeWidth={1.75} />
                ) : (
                    <>
                        <Text style={{ fontSize: scale(18) }}>{current.flag}</Text>
                        <Text
                            variant="body-sm"
                            className="font-body-medium"
                            style={{ marginHorizontal: scale(6) }}
                        >
                            {current.code.toUpperCase()}
                        </Text>
                        <ChevronDown size={scale(14)} color={colors.brand.text.muted} />
                    </>
                )}
            </Pressable>

            {/* animationType="none": the native modal animation adds ~150-300ms
                of latency on Android before anything appears. We mount instantly
                and run our own quick fades instead. */}
            <Modal
                visible={visible}
                transparent
                animationType="none"
                statusBarTranslucent
                hardwareAccelerated
                onRequestClose={() => setVisible(false)}
            >
                <Animated.View entering={FadeIn.duration(120)} style={styles.overlayFill}>
                    <Pressable
                        style={styles.overlay}
                        onPress={() => setVisible(false)}
                    >
                        <Animated.View entering={FadeInDown.duration(160)} style={styles.dropdownWrap}>
                            <Pressable
                                style={[
                                    styles.dropdown,
                                    {
                                        backgroundColor: colors.chrome.common.card,
                                        borderColor: colors.brand.bg.border,
                                    },
                                ]}
                                onPress={() => { }}
                            >
                                <View style={styles.dropdownHeader}>
                                    <Text
                                        variant="body-sm"
                                        className="font-body-semi"
                                        style={{ color: colors.brand.text.subtitle }}
                                    >
                                        {t('language', 'Language')}
                                    </Text>
                                </View>

                                <ScrollView
                                    showsVerticalScrollIndicator={false}
                                    style={{ maxHeight: scale(380) }}
                                >
                                    {LANGUAGES.map((item, index) => {
                                        const isActive = item.code === currentLanguage;
                                        return (
                                            <React.Fragment key={item.code}>
                                                {index > 0 ? (
                                                    <View
                                                        style={{
                                                            height: StyleSheet.hairlineWidth,
                                                            backgroundColor: colors.brand.bg.border,
                                                            marginHorizontal: scale(16),
                                                        }}
                                                    />
                                                ) : null}
                                                <Pressable
                                                    onPress={() => handleSelect(item.code)}
                                                    style={[
                                                        styles.option,
                                                        isActive && { backgroundColor: colors.chrome.common.primaryTint },
                                                    ]}
                                                >
                                                    <Text style={{ fontSize: scale(20) }}>
                                                        {item.flag}
                                                    </Text>
                                                    <Text
                                                        variant="body"
                                                        className={isActive ? 'font-body-semi' : ''}
                                                        style={[
                                                            { flex: 1, marginLeft: scale(12) },
                                                            isActive && { color: colors.chrome.primary },
                                                        ]}
                                                    >
                                                        {item.name}
                                                    </Text>
                                                    {isActive && (
                                                        <View style={styles.checkCircle}>
                                                            <LinearGradient
                                                                colors={[colors.brand.gradient.start, colors.brand.gradient.end]}
                                                                start={{ x: 0, y: 0 }}
                                                                end={{ x: 1, y: 0 }}
                                                                style={StyleSheet.absoluteFill}
                                                            />
                                                            <Check
                                                                size={scale(12)}
                                                                color="#FFFFFF"
                                                                strokeWidth={3}
                                                            />
                                                        </View>
                                                    )}
                                                </Pressable>
                                            </React.Fragment>
                                        );
                                    })}
                                </ScrollView>
                            </Pressable>
                        </Animated.View>
                    </Pressable>
                </Animated.View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    trigger: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: scale(12),
        paddingVertical: scale(8),
        borderRadius: scale(12),
        borderWidth: 1,
    },
    iconTrigger: {
        width: scale(36),
        height: scale(36),
        borderRadius: scale(18),
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth,
    },
    overlayFill: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(24),
    },
    dropdownWrap: {
        width: '100%',
        alignItems: 'center',
    },
    dropdown: {
        width: '100%',
        maxWidth: scale(340),
        borderRadius: scale(16),
        borderWidth: 1,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
    },
    dropdownHeader: {
        paddingHorizontal: scale(16),
        paddingTop: scale(16),
        paddingBottom: scale(10),
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: scale(16),
        paddingVertical: scale(14),
    },
    checkCircle: {
        width: scale(22),
        height: scale(22),
        borderRadius: scale(11),
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
});
