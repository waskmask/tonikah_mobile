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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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

    // Sync when initial changes
    React.useEffect(() => {
        setLocalSelected(initialSelected);
    }, [initialSelected]);

    const filtered = useMemo(() => {
        if (!search.trim()) return options;
        const q = normalizeSearchText(search);
        return options.filter(
            (o) =>
                normalizeSearchText(o.label).includes(q) ||
                normalizeSearchText(o.value).includes(q)
        );
    }, [options, search]);

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
            transparent={resolvedPresentation === 'sheet'}
            animationType="none"
            statusBarTranslucent
            onRequestClose={handleClose}
        >
            <View style={isDrawer ? styles.drawerOverlay : styles.modalRoot}>
                {!isDrawer && (
                    <AnimatedPressable
                        style={[styles.backdrop, { opacity: overlayOpacity }]}
                        onPress={handleClose}
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
                            { backgroundColor: palette.chrome.common.card },
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
                                        { backgroundColor: palette.brand.text.muted },
                                    ]}
                                />
                            </View>
                        )}

                        {/* Header */}
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
                            <View style={{ flex: 1 }}>
                                <Text
                                    variant="body-sm"
                                    className="font-body-bold"
                                    style={[styles.drawerTitle, !isDrawer && styles.sheetTitle]}
                                >
                                    {title}
                                </Text>
                                {maxSelections && (
                                    <Text
                                        variant="body-sm"
                                        style={{
                                            color: palette.brand.text.muted,
                                            marginTop: scale(2),
                                        }}
                                    >
                                        {localSelected.length}/{maxSelections} {t('selected', 'selected')}
                                    </Text>
                                )}
                            </View>
                            {!isDrawer && (
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
                                    {
                                        backgroundColor: palette.brand.bg.surface,
                                        borderColor: palette.brand.bg.border,
                                    },
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
                                                { flex: 1, marginLeft: scale(12) },
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

                        {/* Done button */}
                        <View style={styles.footer}>
                            <GradientButton
                                title={`${t('done', 'Done')}${localSelected.length > 0 ? ` (${localSelected.length})` : ''}`}
                                onPress={handleDone}
                                disabled={localSelected.length === 0}
                            />
                        </View>
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
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        gap: 8,
        paddingTop: 4,
        paddingBottom: 14,
        paddingHorizontal: 18,
    },
    drawerTitle: {
        fontSize: 14,
        lineHeight: 18,
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
    checkbox: {
        width: scale(22),
        height: scale(22),
        borderRadius: scale(6),
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footer: {
        paddingHorizontal: scale(20),
        paddingTop: scale(12),
    },
});
