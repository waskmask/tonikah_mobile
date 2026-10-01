import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, View } from 'react-native';
import { ChevronLeft, ChevronRight, Lock } from '@/components/ui/icons/PhosphorCompat';
import { Text } from '@/components/ui/Text';
import { PressableScale } from '@/components/ui/PressableScale';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/useToast';
import { scale } from '@/hooks/useResponsive';
import { t } from '@/lib/profileDisplay';
import { translateCountry } from '@/lib/profileDisplay';

/** Navigation row for the settings hub: tinted icon, title, subtitle, chevron. */
export function SettingsNavRow({
    icon,
    label,
    description,
    onPress,
    danger,
    disabled,
    loading,
    divider,
    accessory,
    showChevron = true,
    selected,
}: {
    icon: React.ReactNode;
    label: string;
    description?: string;
    onPress: () => void;
    danger?: boolean;
    disabled?: boolean;
    loading?: boolean;
    divider?: boolean;
    accessory?: React.ReactNode;
    showChevron?: boolean;
    selected?: boolean;
}) {
    const colors = useColors();
    const { isRTL } = useLanguage();
    const Chevron = isRTL ? ChevronLeft : ChevronRight;

    return (
        <View>
            {divider ? (
                <View style={[styles.divider, { backgroundColor: colors.brand.bg.border }]} />
            ) : null}
            <PressableScale
                onPress={onPress}
                disabled={disabled}
                activeScale={0.97}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(loading), selected }}
                style={[
                    styles.fieldRow,
                    {
                        opacity: loading ? 1 : disabled ? 0.55 : 1,
                        backgroundColor: selected ? colors.chrome.common.primaryTint : 'transparent',
                    },
                ]}
            >
                <View
                    style={[
                        styles.iconTile,
                        { backgroundColor: danger ? colors.chrome.common.dangerTint : colors.chrome.header.iconBackground },
                    ]}
                >
                    {loading ? (
                        <ActivityIndicator
                            size="small"
                            color={danger ? colors.brand.accent.error : colors.chrome.primary}
                        />
                    ) : icon}
                </View>
                <View style={[styles.fieldContent, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                    <Text
                        variant="caption"
                        numberOfLines={1}
                        style={{
                            color: danger ? colors.brand.accent.error : colors.chrome.common.textStrong,
                            textAlign: isRTL ? 'right' : 'left',
                            width: '100%',
                            fontSize: scale(13),
                            lineHeight: scale(17),
                            letterSpacing: 0,
                            textTransform: 'none',
                        }}
                    >
                        {label}
                    </Text>
                    {description ? (
                        <Text
                            variant="body-sm"
                            style={{
                                color: colors.brand.text.subtitle,
                                textAlign: isRTL ? 'right' : 'left',
                                width: '100%',
                                fontSize: scale(14),
                                lineHeight: scale(20),
                            }}
                            numberOfLines={2}
                        >
                            {description}
                        </Text>
                    ) : null}
                </View>
                {accessory ?? (loading || !showChevron ? null : (
                    <Chevron
                        size={scale(19)}
                        color={colors.brand.text.muted}
                        style={{ flexShrink: 0 }}
                    />
                ))}
            </PressableScale>
        </View>
    );
}

/** Read-only settings field with the same geometry as navigation rows. */
export function SettingsInfoRow({
    icon,
    label,
    value,
    note,
    locked,
    divider,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    note?: string;
    locked?: boolean;
    divider?: boolean;
}) {
    const colors = useColors();
    const { isRTL } = useLanguage();
    const toast = useToast();

    return (
        <View>
            {divider ? (
                <View style={[styles.divider, { backgroundColor: colors.brand.bg.border }]} />
            ) : null}
            <Pressable
                disabled={!locked}
                onPress={() => toast.show(t('cannot_change', 'Cannot be changed'), 'info', 2200)}
                accessibilityRole={locked ? 'button' : undefined}
                accessibilityLabel={`${label}: ${value}`}
                style={styles.fieldRow}
            >
                <View style={[styles.iconTile, { backgroundColor: colors.chrome.header.iconBackground }]}>
                    {icon}
                </View>
                <View style={[styles.fieldContent, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                    <Text
                        variant="caption"
                        numberOfLines={1}
                        style={[styles.fieldLabel, { color: colors.chrome.common.textMuted, textAlign: isRTL ? 'right' : 'left' }]}
                    >
                        {label}
                    </Text>
                    <Text
                        variant="body-sm"
                        style={[styles.fieldValue, { textAlign: isRTL ? 'right' : 'left' }]}
                    >
                        {value || t('not_set', 'Not set')}
                    </Text>
                    {note ? (
                        <Text
                            variant="caption"
                            style={[styles.fieldNote, { color: colors.brand.text.muted, textAlign: isRTL ? 'right' : 'left' }]}
                        >
                            {note}
                        </Text>
                    ) : null}
                </View>
                {locked ? <Lock size={scale(15)} color={colors.brand.text.muted} /> : null}
            </Pressable>
        </View>
    );
}

/** Label + switch row (notifications, marketing opt-in, ...). */
export function SettingsToggleRow({
    icon,
    label,
    description,
    value,
    disabled,
    onValueChange,
    divider,
}: {
    icon?: React.ReactNode;
    label: string;
    description?: string;
    value: boolean;
    disabled?: boolean;
    onValueChange: (next: boolean) => void;
    divider?: boolean;
}) {
    const colors = useColors();
    const { isRTL } = useLanguage();
    return (
        <View>
            {divider ? <View style={[styles.divider, { backgroundColor: colors.brand.bg.border }]} /> : null}
            <View style={styles.fieldRow}>
                {icon ? (
                    <View style={[styles.iconTile, { backgroundColor: colors.chrome.header.iconBackground }]}>
                        {icon}
                    </View>
                ) : null}
                <View style={[styles.fieldContent, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                    <Text variant="body-sm" style={[styles.fieldValue, { textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
                    {description ? (
                        <Text variant="caption" style={{ color: colors.brand.text.subtitle, textAlign: isRTL ? 'right' : 'left' }}>
                            {description}
                        </Text>
                    ) : null}
                </View>
                <Switch
                    value={value}
                    disabled={disabled}
                    onValueChange={onValueChange}
                    trackColor={{ false: colors.brand.bg.border, true: colors.chrome.common.primaryGlow }}
                    thumbColor={value ? colors.chrome.primary : colors.chrome.common.inverseText}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    divider: {
        height: StyleSheet.hairlineWidth,
        marginHorizontal: scale(16),
    },
    fieldRow: {
        minHeight: scale(72),
        paddingHorizontal: scale(16),
        paddingVertical: scale(14),
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(12),
    },
    iconTile: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(8),
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    fieldContent: {
        flex: 1,
        minWidth: 0,
        gap: scale(3),
    },
    fieldLabel: {
        width: '100%',
        fontSize: scale(13),
        lineHeight: scale(17),
    },
    fieldValue: {
        width: '100%',
        fontSize: scale(14),
        lineHeight: scale(20),
    },
    fieldNote: {
        width: '100%',
        marginTop: scale(1),
    },
});

export function formatSessionDate(value: string | undefined, locale: string) {
    if (!value) return t('unknown', 'Unknown');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t('unknown', 'Unknown');
    return date.toLocaleString(locale, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function formatSessionLocation(session: { locationCountryCode?: string; locationCity?: string; privateLocation?: boolean }): string | null {
    const code = session.locationCountryCode?.trim().toUpperCase();
    if (code) {
        const country = translateCountry(code) || code;
        const city = session.locationCity?.trim();
        return city ? `${city}, ${country}` : country;
    }

    return session.privateLocation ? t('session_private_location', 'Private location') : null;
}
