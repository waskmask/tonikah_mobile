import React from 'react';
import { Pressable, Switch, View } from 'react-native';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { PressableScale } from '@/components/ui/PressableScale';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/useToast';
import { scale } from '@/hooks/useResponsive';
import { t } from '@/lib/profileDisplay';
import i18n from '@/lib/i18n';

/** Navigation row for the settings hub: tinted icon, title, subtitle, chevron. */
export function SettingsNavRow({
    icon,
    label,
    description,
    onPress,
    danger,
    disabled,
}: {
    icon: React.ReactNode;
    label: string;
    description?: string;
    onPress: () => void;
    danger?: boolean;
    disabled?: boolean;
}) {
    const colors = useColors();
    const { isRTL } = useLanguage();
    const Chevron = isRTL ? ChevronLeft : ChevronRight;

    return (
        <PressableScale
            onPress={onPress}
            disabled={disabled}
            activeScale={0.97}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: scale(12),
                paddingVertical: scale(12),
                opacity: disabled ? 0.55 : 1,
            }}
        >
            <View
                style={{
                    width: scale(38),
                    height: scale(38),
                    borderRadius: scale(19),
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: danger ? colors.chrome.common.dangerTint : colors.chrome.common.primaryTint,
                }}
            >
                {icon}
            </View>
            <View style={{ flex: 1 }}>
                <Text
                    variant="body"
                    className="font-body-semi"
                    style={{
                        color: danger ? colors.brand.accent.error : colors.chrome.common.textStrong,
                        textAlign: isRTL ? 'right' : 'left',
                    }}
                >
                    {label}
                </Text>
                {description ? (
                    <Text
                        variant="caption"
                        style={{ marginTop: scale(2), color: colors.brand.text.subtitle, textAlign: isRTL ? 'right' : 'left' }}
                        numberOfLines={2}
                    >
                        {description}
                    </Text>
                ) : null}
            </View>
            <Chevron size={scale(18)} color={colors.brand.text.muted} />
        </PressableScale>
    );
}

/** Label + switch row (notifications, marketing opt-in, ...). */
export function SettingsToggleRow({
    label,
    description,
    value,
    disabled,
    onValueChange,
}: {
    label: string;
    description?: string;
    value: boolean;
    disabled?: boolean;
    onValueChange: (next: boolean) => void;
}) {
    const colors = useColors();
    return (
        <View style={{ marginTop: scale(8) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12) }}>
                <View style={{ flex: 1 }}>
                    <Text variant="body" className="font-body-semi">{label}</Text>
                    {description ? (
                        <Text variant="caption" style={{ marginTop: scale(4), color: colors.brand.text.subtitle }}>
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

/** Tappable action row inside a section card. */
export function SettingsActionRow({
    label,
    onPress,
    danger,
    disabled,
    embedded = true,
}: {
    label: string;
    onPress: () => void;
    danger?: boolean;
    disabled?: boolean;
    embedded?: boolean;
}) {
    const colors = useColors();
    return (
        <Pressable
            disabled={disabled}
            onPress={onPress}
            style={{
                marginTop: embedded ? scale(8) : scale(10),
                borderRadius: scale(14),
                padding: scale(14),
                opacity: disabled ? 0.55 : 1,
                backgroundColor: embedded ? 'transparent' : colors.chrome.common.card,
            }}
        >
            <Text variant="body" style={{ color: danger ? colors.brand.accent.error : colors.chrome.common.textStrong }}>
                {label}
            </Text>
        </Pressable>
    );
}

/** Static label/value row (email, language picker, ...). */
export function SettingsValueRow({
    label,
    value,
    custom,
    note,
}: {
    label: string;
    value?: string;
    custom?: React.ReactNode;
    note?: string;
}) {
    const colors = useColors();
    return (
        <View style={{ marginTop: scale(10) }}>
            <Text variant="caption" style={{ color: colors.brand.text.subtitle }}>{label}</Text>
            {custom || <Text variant="body" style={{ marginTop: scale(4) }}>{value}</Text>}
            {note ? (
                <Text variant="caption" style={{ marginTop: scale(4), color: colors.brand.text.muted }}>
                    {note}
                </Text>
            ) : null}
        </View>
    );
}

/** Read-only locked field — tap shows cannot_change toast (web parity). */
export function SettingsLockedRow({ label, value }: { label: string; value: string }) {
    const colors = useColors();
    const toast = useToast();

    return (
        <Pressable
            onPress={() => toast.show(t('cannot_change', 'Cannot be changed'), 'info', 2200)}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${value}`}
            style={{ marginTop: scale(10) }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: scale(8) }}>
                <Text variant="caption" style={{ color: colors.brand.text.subtitle, flex: 1 }}>
                    {label}
                </Text>
                <Lock size={scale(13)} color={colors.brand.text.muted} />
            </View>
            <Text variant="body" style={{ marginTop: scale(4) }}>
                {value || t('not_set', 'Not set')}
            </Text>
        </Pressable>
    );
}

export function formatSessionDate(value?: string) {
    if (!value) return t('unknown', 'Unknown');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t('unknown', 'Unknown');
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function formatSessionLocation(session: { locationCountryCode?: string; locationCity?: string; privateLocation?: boolean }): string | null {
    const code = session.locationCountryCode?.trim().toUpperCase();
    if (code) {
        let country = code;
        try {
            country = new (Intl as any).DisplayNames([i18n.language || 'en'], { type: 'region' }).of(code) || code;
        } catch {
            country = code;
        }

        const city = session.locationCity?.trim();
        return city ? `${city}, ${country}` : country;
    }

    return session.privateLocation ? t('session_private_location', 'Private location') : null;
}
