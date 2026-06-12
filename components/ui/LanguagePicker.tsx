import React, { useState } from 'react';
import {
    View,
    Pressable,
    Modal,
    FlatList,
    StyleSheet,
} from 'react-native';
import { Text } from './Text';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';
import { ChevronDown, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

const LANGUAGES = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'pl', name: 'Polski', flag: '🇵🇱' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
];

export function LanguagePicker() {
    const { currentLanguage, changeLanguage } = useLanguage();
    const { isDark } = useTheme();
    const [visible, setVisible] = useState(false);

    const current = LANGUAGES.find(l => l.code === currentLanguage) || LANGUAGES[0];

    const handleSelect = async (code: string) => {
        setVisible(false);
        if (code !== currentLanguage) {
            await changeLanguage(code);
        }
    };

    return (
        <>
            {/* Trigger */}
            <Pressable
                onPress={() => setVisible(true)}
                style={[
                    styles.trigger,
                    {
                        backgroundColor: isDark ? 'rgba(30,41,59,0.8)' : 'rgba(248,250,252,0.9)',
                        borderColor: isDark ? '#334155' : '#E2E8F0',
                    },
                ]}
            >
                <Text style={{ fontSize: scale(18) }}>{current.flag}</Text>
                <Text
                    variant="body-sm"
                    className="font-body-medium"
                    style={{ marginHorizontal: scale(6) }}
                >
                    {current.code.toUpperCase()}
                </Text>
                <ChevronDown
                    size={scale(14)}
                    color={isDark ? '#94A3B8' : '#6B7280'}
                />
            </Pressable>

            {/* Dropdown Modal */}
            <Modal
                visible={visible}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={() => setVisible(false)}
            >
                <Pressable
                    style={styles.overlay}
                    onPress={() => setVisible(false)}
                >
                    <Pressable
                        style={[
                            styles.dropdown,
                            {
                                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                                borderColor: isDark ? '#334155' : '#E2E8F0',
                            },
                        ]}
                        onPress={() => { }} // Prevent closing when tapping inside
                    >
                        {/* Header */}
                        <View style={styles.dropdownHeader}>
                            <Text
                                variant="body-sm"
                                className="font-body-semi"
                                style={{ color: isDark ? '#94A3B8' : '#6B7280' }}
                            >
                                Select Language
                            </Text>
                        </View>

                        {/* Language List */}
                        <FlatList
                            data={LANGUAGES}
                            keyExtractor={(item) => item.code}
                            showsVerticalScrollIndicator={false}
                            style={{ maxHeight: scale(380) }}
                            renderItem={({ item }) => {
                                const isActive = item.code === currentLanguage;
                                return (
                                    <Pressable
                                        onPress={() => handleSelect(item.code)}
                                        style={[
                                            styles.option,
                                            isActive && {
                                                backgroundColor: isDark
                                                    ? 'rgba(243,75,111,0.1)'
                                                    : 'rgba(243,75,111,0.08)',
                                            },
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
                                                isActive && { color: '#F34B6F' },
                                            ]}
                                        >
                                            {item.name}
                                        </Text>
                                        {isActive && (
                                            <View style={styles.checkCircle}>
                                                <LinearGradient
                                                    colors={['#F34B6F', '#E8447A']}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 1 }}
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
                                );
                            }}
                            ItemSeparatorComponent={() => (
                                <View
                                    style={{
                                        height: StyleSheet.hairlineWidth,
                                        backgroundColor: isDark ? '#334155' : '#F1F5F9',
                                        marginHorizontal: scale(16),
                                    }}
                                />
                            )}
                        />
                    </Pressable>
                </Pressable>
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
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(24),
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
