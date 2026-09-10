import React, { useState, useMemo } from 'react';
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
import Animated, { FadeIn, SlideInDown, SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { Text } from './Text';
import { GradientButton } from './GradientButton';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/hooks/useLanguage';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';
import { Search, X, Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '@/constants/typography';
import { t } from '@/lib/profileDisplay';

export interface MultiSelectOption {
    value: string;
    label: string;
}

interface MultiSelectSheetProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (values: string[]) => void;
    options: MultiSelectOption[];
    selected: string[];
    title: string;
    maxSelections?: number;
    searchEnabled?: boolean;
    searchPlaceholder?: string;
    presentation?: 'sheet' | 'drawer';
}

const normalizeSearchText = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

export function MultiSelectSheet({
    visible,
    onClose,
    onConfirm,
    options,
    selected: initialSelected,
    title,
    maxSelections,
    searchEnabled = true,
    searchPlaceholder = 'Search...',
    presentation,
}: MultiSelectSheetProps) {
    const { isDark } = useTheme();
    const palette = useColors();
    const { currentLanguage, isRTL } = useLanguage();
    const insets = useSafeAreaInsets();
    const searchFontFamily = currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.regular;
    const [search, setSearch] = useState('');
    const [localSelected, setLocalSelected] = useState<string[]>(initialSelected);
    const resolvedPresentation = presentation ?? (searchEnabled ? 'drawer' : 'sheet');
    const isDrawer = resolvedPresentation === 'drawer';
    // Reanimated `entering` starts when the view mounts inside the modal
    // window — effect-driven animations race the window and look stuck.
    const drawerEntering = isRTL ? SlideInLeft.duration(220) : SlideInRight.duration(220);

    // Sync when initial changes
    React.useEffect(() => {
        setLocalSelected(initialSelected);
    }, [initialSelected]);

    // Snapshot of the confirmed selection, taken when the drawer opens: those
    // options are pinned to the top so users can review/unselect them without
    // hunting through a long list. A snapshot (not the live selection) keeps
    // rows from jumping around while toggling.
    const [pinned, setPinned] = useState<string[]>([]);
    React.useEffect(() => {
        if (visible) setPinned(initialSelected);
    }, [visible, initialSelected]);

    const ordered = useMemo(() => {
        if (!isDrawer || pinned.length === 0) return options;
        const pinnedSet = new Set(pinned);
        return [
            ...options.filter((o) => pinnedSet.has(o.value)),
            ...options.filter((o) => !pinnedSet.has(o.value)),
        ];
    }, [options, pinned, isDrawer]);

    const filtered = useMemo(() => {
        if (!search.trim()) return ordered;
        const q = normalizeSearchText(search);
        return ordered.filter(
            (o) =>
                normalizeSearchText(o.label).includes(q) ||
                normalizeSearchText(o.value).includes(q)
        );
    }, [ordered, search]);

    const toggleItem = (value: string) => {
        setLocalSelected((prev) => {
            if (prev.includes(value)) {
                return prev.filter((v) => v !== value);
            }
            if (maxSelections && prev.length >= maxSelections) {
                return prev; // Don't allow more
            }
            return [...prev, value];
        });
    };

    const handleDone = () => {
        onConfirm(localSelected);
        onClose();
        setSearch('');
    };

    const handleClose = () => {
        setLocalSelected(initialSelected); // Reset on cancel
        onClose();
        setSearch('');
    };

    return (
        <Modal
            visible={visible}
            // transparent always: an opaque modal window flashes white before
            // the first frame paints
            transparent
            animationType="none"
            statusBarTranslucent
            navigationBarTranslucent
            hardwareAccelerated
            onRequestClose={handleClose}
        >
            <View style={isDrawer ? styles.drawerOverlay : styles.modalRoot}>
                {!isDrawer && (
                    <Animated.View entering={FadeIn.duration(140)} style={styles.backdrop}>
                        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
                    </Animated.View>
                )}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={isDrawer ? styles.drawerWrapper : styles.sheetWrapper}
                    pointerEvents="box-none"
                >
                    <Animated.View
                        entering={isDrawer ? drawerEntering : SlideInDown.duration(240)}
                        style={[
                            isDrawer ? styles.drawer : styles.sheet,
                            { backgroundColor: palette.chrome.common.card },
                            // Footer button sits at the same height as the page CTA
                            // Footer already pads scale(10) — matching the page CTA's
                            // safe-bottom + scale(10) exactly
                            isDrawer && { paddingTop: insets.top + 6, paddingBottom: insets.bottom },
                            !isDrawer && { paddingBottom: insets.bottom + scale(16) },
                        ]}
                    >
                        {!isDrawer && (
                            <View style={styles.handleBar}>
                                <View
                                    style={[
                                        styles.handle,
                                        { backgroundColor: palette.brand.text.muted },
                                    ]}
                                />
                            </View>
                        )}

                        {/* Header: back arrow + centered title */}
                        <View style={[styles.header, isDrawer && styles.drawerHeader]}>
                            {isDrawer && (
                                <Pressable onPress={handleClose} hitSlop={12} style={styles.backButton}>
                                    {isRTL ? (
                                        <ChevronRight size={22} color={palette.brand.text.body} />
                                    ) : (
                                        <ChevronLeft size={22} color={palette.brand.text.body} />
                                    )}
                                </Pressable>
                            )}
                            <Text
                                variant="body-sm"
                                className="font-body-bold"
                                style={[styles.drawerTitle, !isDrawer && styles.sheetTitle]}
                            >
                                {title}
                            </Text>
                            {isDrawer ? (
                                <View style={styles.headerSpacer} />
                            ) : (
                                <Pressable onPress={handleClose} hitSlop={12}>
                                    <X size={scale(20)} color={palette.brand.text.subtitle} />
                                </Pressable>
                            )}
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

                        {/* Options */}
                        <FlatList
                            data={filtered}
                            keyExtractor={(item) => item.value}
                            showsVerticalScrollIndicator={false}
                            style={isDrawer ? styles.drawerList : { maxHeight: scale(350) }}
                            keyboardShouldPersistTaps="handled"
                            initialNumToRender={16}
                            removeClippedSubviews
                            renderItem={({ item }) => {
                                const isChecked = localSelected.includes(item.value);
                                const isMaxed = !isChecked && maxSelections
                                    ? localSelected.length >= maxSelections
                                    : false;

                                return (
                                    <Pressable
                                        onPress={() => toggleItem(item.value)}
                                        disabled={isMaxed}
                                        style={[
                                            styles.option,
                                            isMaxed && { opacity: 0.4 },
                                            isChecked && {
                                                backgroundColor: isDark
                                                    ? palette.chrome.common.primaryTint
                                                    : palette.chrome.common.primaryTint,
                                            },
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.checkbox,
                                                {
                                                    borderColor: isChecked
                                                        ? palette.chrome.primary
                                                        : palette.brand.text.muted,
                                                    backgroundColor: isChecked
                                                        ? palette.chrome.primary
                                                        : 'transparent',
                                                },
                                            ]}
                                        >
                                            {isChecked && (
                                                <Check size={scale(12)} color={palette.chrome.common.inverseText} strokeWidth={3} />
                                            )}
                                        </View>
                                        <Text
                                            variant="body"
                                            style={[
                                                styles.optionLabel,
                                                {
                                                    color: palette.brand.text.body,
                                                    textAlign: isRTL ? 'right' : 'left',
                                                },
                                                isChecked && { color: palette.chrome.primary },
                                            ]}
                                        >
                                            {item.label}
                                        </Text>
                                    </Pressable>
                                );
                            }}
                            ListEmptyComponent={
                                <View style={{ padding: scale(24), alignItems: 'center' }}>
                                    <Text variant="body-sm" style={{ color: palette.brand.text.muted }}>
                                        {t('no_results_found', 'No results found')}
                                    </Text>
                                </View>
                            }
                        />

                        {/* Selection count + Done button */}
                        <View style={styles.footer}>
                            <Text
                                variant="caption"
                                align="center"
                                style={[styles.countText, { color: palette.brand.text.muted }]}
                            >
                                {maxSelections
                                    ? `${localSelected.length}/${maxSelections} ${t('selected', 'selected')}`
                                    : `${localSelected.length} ${t('selected', 'selected')}`}
                            </Text>
                            <GradientButton
                                title={t('done', 'Done')}
                                onPress={handleDone}
                                disabled={localSelected.length === 0}
                                widthMode="full"
                                height={40}
                                textSize={15}
                            />
                        </View>
                    </Animated.View>
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
        maxHeight: '85%',
    },
    drawer: {
        flex: 1,
        minHeight: Dimensions.get('window').height,
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
        gap: scale(12),
        minHeight: scale(44),
        paddingHorizontal: scale(20),
        paddingVertical: scale(13),
    },
    optionLabel: {
        flex: 1,
        minWidth: 0,
    },
    drawerList: {
        flex: 1,
    },
    // Same size + stroke as the single-select radio
    checkbox: {
        width: scale(20),
        height: scale(20),
        flexShrink: 0,
        borderRadius: scale(6),
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footer: {
        paddingHorizontal: scale(20),
        paddingTop: scale(6),
        paddingBottom: scale(10),
    },
    countText: {
        fontSize: scale(11),
        lineHeight: scale(15),
        marginBottom: scale(8),
    },
});
