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
import { Text } from './Text';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { Search, X, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export interface SelectOption {
    value: string;
    label: string;
    description?: string;
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
}

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
}: SingleSelectSheetProps) {
    const { isDark } = useTheme();
    const { isRTL } = useLanguage();
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search.trim()) return options;
        const q = search.toLowerCase();
        return options.filter(
            (o) =>
                o.label.toLowerCase().includes(q) ||
                o.value.toLowerCase().includes(q)
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
            transparent
            animationType="slide"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.sheetWrapper}
                >
                    <Pressable
                        style={[
                            styles.sheet,
                            {
                                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                                minHeight: minHeight || Dimensions.get('window').height * 0.4,
                            },
                        ]}
                        onPress={() => { }}
                    >
                        {/* Handle bar */}
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
                            <Text variant="heading-sm" className="font-heading-semi">
                                {title}
                            </Text>
                            <Pressable onPress={onClose} hitSlop={12}>
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

                        {/* Options List */}
                        <FlatList
                            data={filtered}
                            keyExtractor={(item) => item.value}
                            showsVerticalScrollIndicator={false}
                            style={{ maxHeight: scale(400) }}
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
                                                    ? 'rgba(254,138,123,0.12)'
                                                    : 'rgba(254,138,123,0.08)',
                                            },
                                        ]}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text
                                                variant="body"
                                                className={isActive ? 'font-body-semi' : ''}
                                                style={isActive ? { color: '#FE8A7B' } : undefined}
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
                                                    colors={['#FE8A7B', '#F34B6F']}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 1 }}
                                                    style={StyleSheet.absoluteFillObject}
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
        maxHeight: '80%',
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
