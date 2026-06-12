import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    View,
    Pressable,
    Modal,
    FlatList,
    TextInput,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Dimensions,
    Animated,
} from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { Search, X, Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '@/constants/typography';

export interface SelectOption {
    value: string;
    label: string;
    description?: string;
    key?: string;
}

interface SingleSelectSheetProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (value: string) => void;
    options: SelectOption[];
    selected?: string;
    title: string;
    searchEnabled?: boolean;
    searchPlaceholder?: string;
    minHeight?: number;
    presentation?: 'sheet' | 'drawer';
}

const normalizeSearchText = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function SingleSelectSheet({
    visible,
    onClose,
    onSelect,
    options,
    selected,
    title,
    searchEnabled = false,
    searchPlaceholder = 'Search...',
    minHeight,
    presentation,
}: SingleSelectSheetProps) {
    const { isDark } = useTheme();
    const { currentLanguage, isRTL } = useLanguage();
    const insets = useSafeAreaInsets();
    const searchFontFamily = currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.regular;
    const [search, setSearch] = useState('');
    const resolvedPresentation = presentation ?? (searchEnabled ? 'drawer' : 'sheet');
    const isDrawer = resolvedPresentation === 'drawer';
    const drawerStartX = isRTL ? -Dimensions.get('window').width : Dimensions.get('window').width;
    const drawerX = useRef(new Animated.Value(drawerStartX)).current;
    const sheetY = useRef(new Animated.Value(Dimensions.get('window').height)).current;
    const overlayOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!visible) return;

        if (isDrawer) {
            drawerX.setValue(drawerStartX);
            Animated.timing(drawerX, {
                toValue: 0,
                duration: 240,
                useNativeDriver: true,
            }).start();
            return;
        }

        overlayOpacity.setValue(0);
        sheetY.setValue(Dimensions.get('window').height);
        Animated.parallel([
            Animated.timing(overlayOpacity, {
                toValue: 1,
                duration: 180,
                useNativeDriver: true,
            }),
            Animated.timing(sheetY, {
                toValue: 0,
                duration: 240,
                useNativeDriver: true,
            }),
        ]).start();
    }, [drawerStartX, drawerX, isDrawer, overlayOpacity, sheetY, visible]);

    const filtered = useMemo(() => {
        if (!search.trim()) return options;
        const q = normalizeSearchText(search);
        return options.filter(
            (o) =>
                normalizeSearchText(o.label).includes(q) ||
                normalizeSearchText(o.value).includes(q)
        );
    }, [options, search]);

    const handleSelect = (value: string) => {
        onSelect(value);
        onClose();
        setSearch('');
    };

    return (
        <Modal
            visible={visible}
            transparent={resolvedPresentation === 'sheet'}
            animationType="none"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View style={isDrawer ? styles.drawerOverlay : styles.modalRoot}>
                {!isDrawer && (
                    <AnimatedPressable
                        style={[styles.backdrop, { opacity: overlayOpacity }]}
                        onPress={onClose}
                    />
                )}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={isDrawer ? styles.drawerWrapper : styles.sheetWrapper}
                    pointerEvents="box-none"
                >
                    <AnimatedPressable
                        style={[
                            isDrawer ? styles.drawer : styles.sheet,
                            {
                                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                            },
                            isDrawer && { minHeight: Dimensions.get('window').height },
                            !isDrawer && { minHeight: minHeight || Dimensions.get('window').height * 0.4 },
                            isDrawer && {
                                paddingTop: insets.top + 18,
                                transform: [{ translateX: drawerX }],
                            },
                            !isDrawer && { transform: [{ translateY: sheetY }] },
                        ]}
                        onPress={() => { }}
                    >
                        {!isDrawer && (
                            <View style={styles.handleBar}>
                                <View
                                    style={[
                                        styles.handle,
                                        { backgroundColor: isDark ? '#475569' : '#CBD5E1' },
                                    ]}
                                />
                            </View>
                        )}

                        {/* Header */}
                        <View style={[styles.header, isDrawer && styles.drawerHeader]}>
                            {isDrawer && (
                                <Pressable onPress={onClose} hitSlop={12} style={styles.backButton}>
                                    {isRTL ? (
                                        <ChevronRight size={22} color={isDark ? '#E2E8F0' : '#0A0D14'} />
                                    ) : (
                                        <ChevronLeft size={22} color={isDark ? '#E2E8F0' : '#0A0D14'} />
                                    )}
                                </Pressable>
                            )}
                            <Text
                                variant="body"
                                className="font-body-semi"
                                style={[styles.drawerTitle, !isDrawer && styles.sheetTitle]}
                            >
                                {title}
                            </Text>
                            {!isDrawer && (
                                <Pressable onPress={onClose} hitSlop={12}>
                                    <X size={scale(20)} color={isDark ? '#94A3B8' : '#6B7280'} />
                                </Pressable>
                            )}
                        </View>

                        {/* Search */}
                        {searchEnabled && (
                            <View
                                style={[
                                    styles.searchContainer,
                                    {
                                        backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                                        borderColor: isDark ? '#334155' : '#E2E8F0',
                                    },
                                ]}
                            >
                                <Search size={scale(16)} color={isDark ? '#64748B' : '#9CA3AF'} />
                                <TextInput
                                    value={search}
                                    onChangeText={setSearch}
                                    placeholder={searchPlaceholder}
                                    placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
                                    style={[
                                        styles.searchInput,
                                        {
                                            color: isDark ? '#E2E8F0' : '#0A0D14',
                                            fontFamily: searchFontFamily,
                                            textAlign: isRTL ? 'right' : 'left',
                                        },
                                    ]}
                                />
                                {search.length > 0 && (
                                    <Pressable onPress={() => setSearch('')} hitSlop={8}>
                                        <X size={scale(14)} color={isDark ? '#64748B' : '#9CA3AF'} />
                                    </Pressable>
                                )}
                            </View>
                        )}

                        {/* Options List */}
                        <FlatList
                            data={filtered}
                            keyExtractor={(item) => item.value}
                            showsVerticalScrollIndicator={false}
                            style={isDrawer ? styles.drawerList : { maxHeight: scale(400) }}
                            keyboardShouldPersistTaps="handled"
                            renderItem={({ item }) => {
                                const isActive = item.value === selected;
                                return (
                                    <Pressable
                                        onPress={() => handleSelect(item.value)}
                                        style={[
                                            styles.option,
                                            isActive && {
                                                backgroundColor: isDark
                                                    ? 'rgba(243,75,111,0.12)'
                                                    : 'rgba(243,75,111,0.08)',
                                            },
                                        ]}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text
                                                variant="body"
                                                className={isActive ? 'font-body-semi' : ''}
                                                style={isActive ? { color: '#F34B6F' } : undefined}
                                            >
                                                {item.label}
                                            </Text>
                                            {item.description && (
                                                <Text
                                                    variant="body-sm"
                                                    style={{
                                                        color: isDark ? '#64748B' : '#9CA3AF',
                                                        marginTop: scale(2),
                                                    }}
                                                >
                                                    {item.description}
                                                </Text>
                                            )}
                                        </View>
                                        {isActive && (
                                            <View style={styles.checkCircle}>
                                                <LinearGradient
                                                    colors={['#F34B6F', '#E8447A']}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 1 }}
                                                    style={StyleSheet.absoluteFill}
                                                />
                                                <Check size={scale(12)} color="#FFF" strokeWidth={3} />
                                            </View>
                                        )}
                                    </Pressable>
                                );
                            }}
                            ListEmptyComponent={
                                <View style={{ padding: scale(24), alignItems: 'center' }}>
                                    <Text variant="body-sm" style={{ color: isDark ? '#64748B' : '#9CA3AF' }}>
                                        No results found
                                    </Text>
                                </View>
                            }
                        />
                    </AnimatedPressable>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalRoot: {
        flex: 1,
    },
    backdrop: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    drawerOverlay: {
        flex: 1,
    },
    sheetWrapper: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    drawerWrapper: {
        flex: 1,
    },
    sheet: {
        borderTopLeftRadius: scale(20),
        borderTopRightRadius: scale(20),
        paddingBottom: scale(34),
        maxHeight: '80%',
    },
    drawer: {
        flex: 1,
        paddingBottom: scale(18),
    },
    handleBar: {
        alignItems: 'center',
        paddingTop: scale(10),
        paddingBottom: scale(6),
    },
    handle: {
        width: scale(36),
        height: scale(4),
        borderRadius: scale(2),
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: scale(20),
        paddingVertical: scale(12),
    },
    drawerHeader: {
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        gap: 8,
        paddingTop: 4,
        paddingBottom: 14,
        paddingHorizontal: 18,
    },
    drawerTitle: {
        flex: 1,
        fontSize: 22,
        lineHeight: 28,
    },
    sheetTitle: {
        fontSize: 19,
        lineHeight: 24,
    },
    backButton: {
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: -8,
        marginTop: -3,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: scale(20),
        marginBottom: scale(10),
        paddingHorizontal: scale(12),
        height: scale(46),
        borderRadius: scale(12),
        borderWidth: 1,
        gap: scale(8),
    },
    searchInput: {
        flex: 1,
        fontSize: scale(14),
        padding: 0,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: scale(20),
        paddingVertical: scale(13),
    },
    drawerList: {
        flex: 1,
    },
    checkCircle: {
        width: scale(22),
        height: scale(22),
        borderRadius: scale(11),
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        marginLeft: scale(12),
    },
});
