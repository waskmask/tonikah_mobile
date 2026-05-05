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
} from 'react-native';
import { Text } from './Text';
import { GradientButton } from './GradientButton';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { Search, X, Check } from 'lucide-react-native';

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
}

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
}: MultiSelectSheetProps) {
    const { isDark } = useTheme();
    const { isRTL } = useLanguage();
    const [search, setSearch] = useState('');
    const [localSelected, setLocalSelected] = useState<string[]>(initialSelected);

    // Sync when initial changes
    React.useEffect(() => {
        setLocalSelected(initialSelected);
    }, [initialSelected]);

    const filtered = useMemo(() => {
        if (!search.trim()) return options;
        const q = search.toLowerCase();
        return options.filter(
            (o) =>
                o.label.toLowerCase().includes(q) ||
                o.value.toLowerCase().includes(q)
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
            transparent
            animationType="slide"
            statusBarTranslucent
            onRequestClose={handleClose}
        >
            <Pressable style={styles.overlay} onPress={handleClose}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.sheetWrapper}
                >
                    <Pressable
                        style={[
                            styles.sheet,
                            { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' },
                        ]}
                        onPress={() => { }}
                    >
                        {/* Handle */}
                        <View style={styles.handleBar}>
                            <View
                                style={[
                                    styles.handle,
                                    { backgroundColor: isDark ? '#475569' : '#CBD5E1' },
                                ]}
                            />
                        </View>

                        {/* Header */}
                        <View style={styles.header}>
                            <View style={{ flex: 1 }}>
                                <Text variant="heading-sm" className="font-heading-semi">
                                    {title}
                                </Text>
                                {maxSelections && (
                                    <Text
                                        variant="body-sm"
                                        style={{
                                            color: isDark ? '#64748B' : '#9CA3AF',
                                            marginTop: scale(2),
                                        }}
                                    >
                                        {localSelected.length}/{maxSelections} selected
                                    </Text>
                                )}
                            </View>
                            <Pressable onPress={handleClose} hitSlop={12}>
                                <X size={scale(20)} color={isDark ? '#94A3B8' : '#6B7280'} />
                            </Pressable>
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

                        {/* Options */}
                        <FlatList
                            data={filtered}
                            keyExtractor={(item) => item.value}
                            showsVerticalScrollIndicator={false}
                            style={{ maxHeight: scale(350) }}
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
                                                    ? 'rgba(254,138,123,0.12)'
                                                    : 'rgba(254,138,123,0.08)',
                                            },
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.checkbox,
                                                {
                                                    borderColor: isChecked
                                                        ? '#FE8A7B'
                                                        : isDark ? '#475569' : '#CBD5E1',
                                                    backgroundColor: isChecked
                                                        ? '#FE8A7B'
                                                        : 'transparent',
                                                },
                                            ]}
                                        >
                                            {isChecked && (
                                                <Check size={scale(12)} color="#FFF" strokeWidth={3} />
                                            )}
                                        </View>
                                        <Text
                                            variant="body"
                                            style={[
                                                { flex: 1, marginLeft: scale(12) },
                                                isChecked && { color: '#FE8A7B' },
                                            ]}
                                        >
                                            {item.label}
                                        </Text>
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

                        {/* Done button */}
                        <View style={styles.footer}>
                            <GradientButton
                                title={`Done${localSelected.length > 0 ? ` (${localSelected.length})` : ''}`}
                                onPress={handleDone}
                                disabled={localSelected.length === 0}
                            />
                        </View>
                    </Pressable>
                </KeyboardAvoidingView>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    sheetWrapper: {
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: scale(20),
        borderTopRightRadius: scale(20),
        paddingBottom: scale(34),
        maxHeight: '85%',
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
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: scale(20),
        marginBottom: scale(8),
        paddingHorizontal: scale(12),
        height: scale(42),
        borderRadius: scale(10),
        borderWidth: 1,
        gap: scale(8),
    },
    searchInput: {
        flex: 1,
        fontSize: scale(14),
        fontFamily: 'Inter_400Regular',
        padding: 0,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: scale(20),
        paddingVertical: scale(14),
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
