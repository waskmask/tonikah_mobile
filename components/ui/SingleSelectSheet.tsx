import React, { useState, useMemo, useCallback, useRef } from 'react';
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
    BottomSheetFlatList,
    BottomSheetTextInput,
    useBottomSheetTimingConfigs,
} from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { Text } from './Text';
import { Skeleton } from './Skeleton';
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
    destructive?: boolean;
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
    loading?: boolean;
    error?: boolean;
    onRetry?: () => void;
    optionMode?: 'select' | 'action';
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
    loading = false,
    error = false,
    onRetry,
    optionMode = 'select',
}: SingleSelectSheetProps) {
    const { isDark } = useTheme();
    const palette = useColors();
    const { currentLanguage, isRTL } = useLanguage();
    const insets = useSafeAreaInsets();
    const { lightImpact } = useHaptics();
    const searchFontFamily = currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.regular;
    const optionFontFamily = currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.medium;
    const [search, setSearch] = useState('');
    const sheetRef = useRef<BottomSheet>(null);
    const nextPresentation = presentation ?? (searchEnabled ? 'drawer' : 'sheet');
    const wasVisibleRef = useRef(false);
    const openPresentationRef = useRef(nextPresentation);
    const isOpening = visible && !wasVisibleRef.current;
    if (!visible || isOpening) openPresentationRef.current = nextPresentation;
    const resolvedPresentation = visible ? openPresentationRef.current : nextPresentation;
    const isDrawer = resolvedPresentation === 'drawer';
    const animationConfigs = useBottomSheetTimingConfigs({
        duration: 220,
        easing: Easing.bezier(0.32, 0.72, 0, 1),
    });

    React.useEffect(() => {
        wasVisibleRef.current = visible;
    }, [visible]);

    // Snapshot of the selection, taken when the drawer opens: that option is
    // pinned to the top so users can find their current choice in long lists
    // without scrolling. Snapshot (not live) so the list doesn't reshuffle
    // the moment a new option is tapped.
    const [pinned, setPinned] = useState<string | undefined>(undefined);
    React.useEffect(() => {
        if (visible) setPinned(selected);
        else setSearch('');
    }, [visible, selected]);

    const pinEnabled = isDrawer || searchEnabled;
    const ordered = useMemo(() => {
        if (!pinEnabled || !pinned) return options;
        const hit = options.find((o) => o.value === pinned);
        if (!hit) return options;
        return [hit, ...options.filter((o) => o.value !== pinned)];
    }, [options, pinned, pinEnabled]);

    const filtered = useMemo(() => {
        if (!search.trim()) return ordered;
        const q = normalizeSearchText(search);
        return ordered.filter(
            (o) =>
                normalizeSearchText(o.label).includes(q) ||
                normalizeSearchText(o.value).includes(q)
        );
    }, [ordered, search]);

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
        const isActive = optionMode === 'select' && item.value === selected;
        const optionColor = item.destructive
            ? palette.brand.accent.error
            : isActive
                ? palette.chrome.primary
                : palette.brand.text.body;
        return (
            <Pressable
                onPress={() => handleSelect(item.value)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={[
                    styles.option,
                    { flexDirection: 'row' },
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
                                color: optionColor,
                            },
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
                {optionMode === 'action' ? null : isActive ? (
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

    const initialLoading = loading && options.length === 0;
    const loadingSkeleton = (
        <View style={styles.skeletonList} pointerEvents="none">
            {[0, 1, 2].map((index) => (
                <View key={index} style={styles.skeletonRow}>
                    <Skeleton height={scale(16)} width={`${68 - index * 8}%`} borderRadius={scale(6)} />
                    <Skeleton height={scale(20)} width={scale(20)} borderRadius={scale(10)} />
                </View>
            ))}
        </View>
    );
    const emptyList = initialLoading ? loadingSkeleton : (
        <View style={styles.loadState}>
            {error ? (
                <>
                    <Text variant="body-sm" align="center" style={{ color: palette.brand.text.muted }}>
                        {t('options_load_error', 'Could not load options')}
                    </Text>
                    {onRetry ? (
                        <Pressable onPress={onRetry} accessibilityRole="button" style={styles.retryButton}>
                            <Text variant="body-sm" className="font-body-semi" style={{ color: palette.chrome.primary }}>
                                {t('btn_try_again', 'Try again')}
                            </Text>
                        </Pressable>
                    ) : null}
                </>
            ) : (
                <Text variant="body-sm" style={{ color: palette.brand.text.muted }}>
                    {t('no_results_found', 'No results found')}
                </Text>
            )}
        </View>
    );

    // Deterministic sheet height: dynamic sizing can measure content as 0
    // (invisible sheet), so compute from option count instead.
    const rowsHeight = options.reduce(
        (sum, option) => sum + (option.description ? scale(66) : scale(48)),
        0,
    );
    const contentSheetHeight = Math.max(
        Math.min(
            scale(88) + (searchEnabled ? scale(54) : 0) + insets.bottom + rowsHeight,
            Dimensions.get('window').height * 0.75,
        ),
        minHeight || scale(180),
    );
    const loadingSheetHeight = Math.min(
        scale(280) + insets.bottom,
        Dimensions.get('window').height * 0.48,
    );
    const sheetHeight = initialLoading ? loadingSheetHeight : contentSheetHeight;
    const snapPoints = useMemo(() => [sheetHeight], [sheetHeight]);
    const previousSheetHeightRef = useRef(sheetHeight);
    React.useEffect(() => {
        // The sheet already mounts at the current snap point. Resnapping while
        // its opening animation is running makes it jump on slower devices.
        if (!visible || isDrawer || isOpening) {
            previousSheetHeightRef.current = sheetHeight;
            return;
        }
        if (previousSheetHeightRef.current === sheetHeight) return;
        previousSheetHeightRef.current = sheetHeight;
        const frame = requestAnimationFrame(() => {
            sheetRef.current?.snapToIndex(0, animationConfigs);
        });
        return () => cancelAnimationFrame(frame);
    }, [animationConfigs, isDrawer, isOpening, sheetHeight, visible]);

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
                navigationBarTranslucent
                hardwareAccelerated
                onRequestClose={onClose}
            >
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <BottomSheet
                        ref={sheetRef}
                        snapPoints={snapPoints}
                        index={0}
                        animationConfigs={animationConfigs}
                        enablePanDownToClose
                        enableDynamicSizing={false}
                        onClose={onClose}
                        backdropComponent={renderBackdrop}
                        backgroundStyle={{ backgroundColor: palette.chrome.common.card }}
                        handleIndicatorStyle={{ backgroundColor: palette.brand.text.muted }}
                        keyboardBehavior="extend"
                        keyboardBlurBehavior="restore"
                        android_keyboardInputMode="adjustResize"
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
                        {searchEnabled && (
                            <View
                                style={[
                                    styles.searchContainer,
                                    { borderBottomColor: palette.brand.bg.border },
                                ]}
                            >
                                <Search size={scale(16)} color={palette.brand.text.muted} />
                                <BottomSheetTextInput
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
                        <BottomSheetFlatList
                            data={filtered}
                            keyExtractor={(item: SelectOption) => item.value}
                            renderItem={renderOption}
                            ListEmptyComponent={emptyList}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            initialNumToRender={14}
                            maxToRenderPerBatch={20}
                            windowSize={7}
                            removeClippedSubviews
                            contentContainerStyle={{
                                paddingBottom: insets.bottom + scale(16),
                            }}
                        />
                    </BottomSheet>
                </GestureHandlerRootView>
            </Modal>
        );
    }

    // ---- Drawer mode: full-screen slide-in with search ----
    const drawerEntering = isRTL
        ? SlideInLeft.duration(220).easing(Easing.bezier(0.32, 0.72, 0, 1))
        : SlideInRight.duration(220).easing(Easing.bezier(0.32, 0.72, 0, 1));

    return (
        <Modal
            visible={visible}
            // transparent: an opaque modal window flashes white before the
            // drawer's first frame paints
            transparent
            animationType="none"
            statusBarTranslucent
            navigationBarTranslucent
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
                                paddingTop: insets.top + 6,
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
                            initialNumToRender={14}
                            maxToRenderPerBatch={20}
                            windowSize={7}
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
    loadState: {
        minHeight: scale(128),
        padding: scale(24),
        gap: scale(12),
        alignItems: 'center',
        justifyContent: 'center',
    },
    skeletonList: {
        paddingTop: scale(4),
    },
    skeletonRow: {
        minHeight: scale(48),
        paddingHorizontal: scale(20),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: scale(16),
    },
    retryButton: {
        minHeight: scale(40),
        paddingHorizontal: scale(16),
        alignItems: 'center',
        justifyContent: 'center',
    },
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
