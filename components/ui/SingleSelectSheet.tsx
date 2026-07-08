import React, { useState, useMemo, useCallback } from 'react';
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
} from 'react-native';
import BottomSheet, {
    BottomSheetBackdrop,
    BottomSheetBackdropProps,
    BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { Text } from './Text';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/hooks/useLanguage';
import { useColors } from '@/hooks/useColors';
import { useHaptics } from '@/hooks/useHaptics';
import { scale } from '@/hooks/useResponsive';
import { Search, X, Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '@/constants/typography';
import { t } from '@/lib/profileDisplay';

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
        .replace(/[̀-ͯ]/g, '')
        .trim()
        .toLowerCase();

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
    const palette = useColors();
    const { currentLanguage, isRTL } = useLanguage();
    const insets = useSafeAreaInsets();
    const { lightImpact } = useHaptics();
    const searchFontFamily = currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.regular;
    const optionFontFamily = currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.medium;
    const [search, setSearch] = useState('');
    const resolvedPresentation = presentation ?? (searchEnabled ? 'drawer' : 'sheet');
    const isDrawer = resolvedPresentation === 'drawer';

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
        lightImpact();
        onSelect(value);
        onClose();
        setSearch('');
    };

    const renderBackdrop = useCallback(
        (props: BottomSheetBackdropProps) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                pressBehavior="close"
                opacity={0.4}
            />
        ),
        [],
    );

    const renderOption = ({ item }: { item: SelectOption }) => {
        const isActive = item.value === selected;
        return (
            <Pressable
                onPress={() => handleSelect(item.value)}
                style={[
                    styles.option,
                    { flexDirection: isRTL ? 'row-reverse' : 'row' },
                    isActive && { backgroundColor: palette.chrome.common.primaryTint },
                ]}
            >
                <View style={{ flex: 1 }}>
                    <Text
                        variant="body"
                        numberOfLines={2}
                        style={[
                            {
                                fontSize: scale(15),
                                fontFamily: optionFontFamily,
                                textAlign: isRTL ? 'right' : 'left',
                            },
                            isActive && { color: palette.chrome.primary },
                        ]}
                    >
                        {item.label}
                    </Text>
                    {item.description && (
                        <Text
                            variant="body-sm"
                            style={{
                                color: palette.brand.text.muted,
                                marginTop: scale(2),
                                textAlign: isRTL ? 'right' : 'left',
                            }}
                        >
                            {item.description}
                        </Text>
                    )}
                </View>
                {/* Radio indicator: outline when idle, gradient-filled when chosen */}
                {isActive ? (
                    <View style={styles.radioActive}>
                        <LinearGradient
                            colors={[palette.brand.gradient.start, palette.brand.gradient.end]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                        />
                        <Check size={scale(12)} color={palette.chrome.common.inverseText} strokeWidth={3} />
                    </View>
                ) : (
                    <View
                        style={[
                            styles.radioIdle,
                            { borderColor: isDark ? palette.brand.bg.border : palette.brand.text.muted },
                        ]}
                    />
                )}
            </Pressable>
        );
    };

    const emptyList = (
        <View style={{ padding: scale(24), alignItems: 'center' }}>
            <Text variant="body-sm" style={{ color: palette.brand.text.muted }}>
                {t('no_results_found', 'No results found')}
            </Text>
        </View>
    );

    // Deterministic sheet height: dynamic sizing can measure content as 0
    // (invisible sheet), so compute from option count instead.
    const rowsHeight = options.reduce(
        (sum, option) => sum + (option.description ? scale(66) : scale(48)),
        0,
    );
    const sheetHeight = Math.max(
        Math.min(
            scale(88) + insets.bottom + rowsHeight,
            Dimensions.get('window').height * 0.75,
        ),
        minHeight || scale(180),
    );

    // ---- Sheet mode: gorhom BottomSheet inside a native RN Modal ----
    // The BottomSheetModal portal can render UNDER expo-router's native screen
    // containers (invisible, no error). A real Modal window is always on top.
    if (!isDrawer) {
        return (
            <Modal
                visible={visible}
                transparent
                animationType="none"
                statusBarTranslucent
                hardwareAccelerated
                onRequestClose={onClose}
            >
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <BottomSheet
                        snapPoints={[sheetHeight]}
                        index={0}
                        enablePanDownToClose
                        enableDynamicSizing={false}
                        onClose={onClose}
                        backdropComponent={renderBackdrop}
                        backgroundStyle={{ backgroundColor: palette.chrome.common.card }}
                        handleIndicatorStyle={{ backgroundColor: palette.brand.text.muted }}
                    >
                        <View style={styles.header}>
                            <Text
                                variant="body-sm"
                                className="font-body-bold"
                                style={styles.sheetTitle}
                            >
                                {title}
                            </Text>
                            <Pressable onPress={onClose} hitSlop={12}>
                                <X size={scale(20)} color={palette.brand.text.subtitle} />
                            </Pressable>
                        </View>
                        <BottomSheetScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{
                                paddingBottom: insets.bottom + scale(16),
                            }}
                        >
                            {filtered.length === 0
                                ? emptyList
                                : filtered.map((item) => (
                                    <React.Fragment key={item.value}>
                                        {renderOption({ item })}
                                    </React.Fragment>
                                ))}
                        </BottomSheetScrollView>
                    </BottomSheet>
                </GestureHandlerRootView>
            </Modal>
        );
    }

    // ---- Drawer mode: full-screen slide-in with search ----
    const drawerEntering = isRTL ? SlideInLeft.duration(220) : SlideInRight.duration(220);

    return (
        <Modal
            visible={visible}
            // transparent: an opaque modal window flashes white before the
            // drawer's first frame paints
            transparent
            animationType="none"
            statusBarTranslucent
            hardwareAccelerated
            onRequestClose={onClose}
        >
            <GestureHandlerRootView style={styles.drawerOverlay}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.drawerWrapper}
                    pointerEvents="box-none"
                >
                    <Animated.View
                        entering={drawerEntering}
                        style={[
                            styles.drawer,
                            {
                                backgroundColor: palette.chrome.common.card,
                                minHeight: Dimensions.get('window').height,
                                paddingTop: insets.top + 18,
                            },
                        ]}
                    >
                        {/* Header: back arrow + centered title */}
                        <View style={[styles.header, styles.drawerHeader]}>
                            <Pressable onPress={onClose} hitSlop={12} style={styles.backButton}>
                                {isRTL ? (
                                    <ChevronRight size={22} color={palette.brand.text.body} />
                                ) : (
                                    <ChevronLeft size={22} color={palette.brand.text.body} />
                                )}
                            </Pressable>
                            <Text
                                variant="body-sm"
                                className="font-body-bold"
                                style={styles.drawerTitle}
                            >
                                {title}
                            </Text>
                            <View style={styles.headerSpacer} />
                        </View>

                        {/* Search */}
                        {searchEnabled && (
                            <View
                                style={[
                                    styles.searchContainer,
                                    { borderBottomColor: palette.brand.bg.border },
                                ]}
                            >
                                <Search size={scale(16)} color={palette.brand.text.muted} />
                                <TextInput
                                    value={search}
                                    onChangeText={setSearch}
                                    placeholder={searchPlaceholder}
                                    placeholderTextColor={palette.brand.text.muted}
                                    style={[
                                        styles.searchInput,
                                        {
                                            color: palette.brand.text.body,
                                            fontFamily: searchFontFamily,
                                            textAlign: isRTL ? 'right' : 'left',
                                        },
                                    ]}
                                />
                                {search.length > 0 && (
                                    <Pressable onPress={() => setSearch('')} hitSlop={8}>
                                        <X size={scale(14)} color={palette.brand.text.muted} />
                                    </Pressable>
                                )}
                            </View>
                        )}

                        {/* Options List */}
                        <FlatList
                            data={filtered}
                            keyExtractor={(item) => item.value}
                            showsVerticalScrollIndicator={false}
                            style={styles.drawerList}
                            keyboardShouldPersistTaps="handled"
                            initialNumToRender={16}
                            removeClippedSubviews
                            renderItem={renderOption}
                            ListEmptyComponent={emptyList}
                        />
                    </Animated.View>
                </KeyboardAvoidingView>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    drawerOverlay: {
        flex: 1,
    },
    drawerWrapper: {
        flex: 1,
    },
    drawer: {
        flex: 1,
        paddingBottom: scale(18),
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: scale(20),
        paddingVertical: scale(12),
    },
    drawerHeader: {
        alignItems: 'center',
        gap: 8,
        paddingTop: 4,
        paddingBottom: 14,
        paddingHorizontal: 18,
    },
    drawerTitle: {
        flex: 1,
        fontSize: scale(16),
        lineHeight: scale(21),
        textAlign: 'center',
    },
    headerSpacer: {
        width: 34,
    },
    sheetTitle: {
        flex: 1,
        fontSize: 14,
        lineHeight: 18,
    },
    backButton: {
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: -8,
        marginTop: -3,
    },
    // Underline style, matching the app's inputs
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: scale(20),
        marginBottom: scale(10),
        paddingHorizontal: scale(6),
        height: scale(44),
        borderBottomWidth: 1,
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
        gap: scale(12),
    },
    drawerList: {
        flex: 1,
    },
    radioActive: {
        width: scale(20),
        height: scale(20),
        borderRadius: scale(10),
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    radioIdle: {
        width: scale(20),
        height: scale(20),
        borderRadius: scale(10),
        borderWidth: 1,
    },
});
