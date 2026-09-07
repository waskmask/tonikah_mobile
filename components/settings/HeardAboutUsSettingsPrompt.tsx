import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import BottomSheet, {
    BottomSheetBackdrop,
    type BottomSheetBackdropProps,
    BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CheckCircle2, Megaphone, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingsNavRow } from '@/components/settings/SettingsRows';
import { SectionCard } from '@/components/ui/SectionCard';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { authService } from '@/lib/authService';
import { translateApiError } from '@/lib/apiErrorTranslator';
import { t } from '@/lib/profileDisplay';

const OPTIONS = [
    { value: 'google_search', fallback: 'Google search' },
    { value: 'instagram', fallback: 'Instagram' },
    { value: 'tiktok', fallback: 'TikTok' },
    { value: 'facebook', fallback: 'Facebook' },
    { value: 'friend_family', fallback: 'Friend or family' },
    { value: 'mosque_community', fallback: 'Mosque or community' },
    { value: 'online_ad', fallback: 'Online ad' },
    { value: 'app_store', fallback: 'App Store or Play Store' },
    { value: 'youtube', fallback: 'YouTube' },
    { value: 'ai_tools', fallback: 'AI tools (ChatGPT, Claude, Gemini, etc.)' },
    { value: 'other', fallback: 'Other' },
] as const;

type OptionValue = (typeof OPTIONS)[number]['value'];

type Props = {
    onAnswered: () => void;
};

/** Settings-only prompt (no dismiss) — mirrors web HeardAboutUsSettingsPrompt. */
export function HeardAboutUsSettingsPrompt({ onAnswered }: Props) {
    const colors = useColors();
    const primary = colors.chrome.primary;
    const [open, setOpen] = useState(false);

    return (
        <>
            <SectionCard title={t('help_us_improve', 'Help us improve')}>
                <SettingsNavRow
                    icon={<Megaphone size={scale(18)} color={primary} />}
                    label={t('heard_about_us_settings_label', 'Help us improve')}
                    description={t('heard_about_us_settings_value', 'Tell us how you found ToNikah')}
                    onPress={() => setOpen(true)}
                />
            </SectionCard>

            <HeardAboutUsSheet
                open={open}
                onClose={() => setOpen(false)}
                onAnswered={() => {
                    setOpen(false);
                    onAnswered();
                }}
            />
        </>
    );
}

function HeardAboutUsSheet({
    open,
    onClose,
    onAnswered,
}: {
    open: boolean;
    onClose: () => void;
    onAnswered: () => void;
}) {
    const colors = useColors();
    const { isRTL, currentLanguage } = useLanguage();
    const insets = useSafeAreaInsets();
    const toast = useToast();
    const [selected, setSelected] = useState<OptionValue | ''>('');
    const [otherText, setOtherText] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const options = useMemo(
        () =>
            OPTIONS.map((option) => ({
                ...option,
                label: t(`heard_about_us_option_${option.value}`, option.fallback),
            })),
        [currentLanguage],
    );

    const renderBackdrop = useCallback(
        (props: BottomSheetBackdropProps) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                opacity={0.42}
                pressBehavior={saving ? 'none' : 'close'}
            />
        ),
        [saving],
    );

    const save = async () => {
        setError('');
        if (!selected) {
            setError(t('heard_about_us_required', 'Please choose one option.'));
            return;
        }
        if (selected === 'other' && !otherText.trim()) {
            setError(t('heard_about_us_other_required', 'Please tell us where you heard about us.'));
            return;
        }

        setSaving(true);
        const result = await authService.updateHeardAboutUs({
            heard_about_us: selected,
            heard_about_us_other: selected === 'other' ? otherText.trim() : '',
        });
        setSaving(false);

        if (result.success) {
            const message = t(
                result.message || 'heard_about_us_saved',
                t('heard_about_us_saved', 'Thank you. Your answer has been saved.'),
            );
            toast.show(message, 'success', 3000);
            onAnswered();
            return;
        }

        const message = translateApiError(result.message || 'server_error_default');
        setError(message);
    };

    if (!open) return null;

    return (
        <Modal
            visible={open}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={saving ? undefined : onClose}
        >
            <GestureHandlerRootView style={{ flex: 1 }}>
                <BottomSheet
                    index={0}
                    snapPoints={['88%']}
                    enablePanDownToClose={!saving}
                    enableDynamicSizing={false}
                    onClose={onClose}
                    backdropComponent={renderBackdrop}
                    backgroundStyle={{ backgroundColor: colors.chrome.common.card }}
                    handleIndicatorStyle={{ backgroundColor: colors.brand.text.muted }}
                >
                    <View style={[styles.header, { borderBottomColor: colors.brand.bg.border }]}>
                        <View style={[styles.iconWrap, { backgroundColor: colors.chrome.common.primaryTint }]}>
                            <Megaphone size={scale(20)} color={colors.chrome.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text variant="h3" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                                {t('heard_about_us_title', 'How did you hear about ToNikah?')}
                            </Text>
                            <Text
                                variant="caption"
                                style={{
                                    marginTop: scale(4),
                                    color: colors.brand.text.subtitle,
                                    textAlign: isRTL ? 'right' : 'left',
                                }}
                            >
                                {t('heard_about_us_desc', 'One quick answer helps us improve where we spend our time.')}
                            </Text>
                        </View>
                        <Pressable
                            onPress={onClose}
                            disabled={saving}
                            hitSlop={8}
                            accessibilityLabel={t('close', 'Close')}
                            style={[styles.closeBtn, { backgroundColor: colors.brand.bg.surface }]}
                        >
                            <X size={scale(16)} color={colors.brand.text.subtitle} />
                        </Pressable>
                    </View>

                    <BottomSheetScrollView
                        contentContainerStyle={{
                            paddingHorizontal: scale(14),
                            paddingTop: scale(12),
                            paddingBottom: scale(16),
                            gap: scale(8),
                        }}
                    >
                        {options.map((option) => {
                            const active = selected === option.value;
                            return (
                                <Pressable
                                    key={option.value}
                                    disabled={saving}
                                    onPress={() => setSelected(option.value)}
                                    style={[
                                        styles.option,
                                        {
                                            borderColor: active ? colors.chrome.primary : colors.brand.bg.border,
                                            backgroundColor: active
                                                ? colors.chrome.common.primaryTint
                                                : colors.brand.bg.surface,
                                        },
                                    ]}
                                >
                                    <Text
                                        variant="body-sm"
                                        className="font-body-semi"
                                        style={{
                                            flex: 1,
                                            color: active ? colors.chrome.primary : colors.chrome.common.textStrong,
                                            textAlign: isRTL ? 'right' : 'left',
                                        }}
                                    >
                                        {option.label}
                                    </Text>
                                    {active ? <CheckCircle2 size={scale(18)} color={colors.chrome.primary} /> : null}
                                </Pressable>
                            );
                        })}

                        {selected === 'other' ? (
                            <TextInput
                                value={otherText}
                                onChangeText={(value) => setOtherText(value.slice(0, 120))}
                                editable={!saving}
                                maxLength={120}
                                placeholder={t('heard_about_us_other_placeholder', 'Please tell us')}
                                placeholderTextColor={colors.brand.text.muted}
                                style={[
                                    styles.otherInput,
                                    {
                                        borderColor: colors.brand.bg.border,
                                        color: colors.chrome.common.textStrong,
                                        backgroundColor: colors.brand.bg.surface,
                                        textAlign: isRTL ? 'right' : 'left',
                                    },
                                ]}
                            />
                        ) : null}

                        {error ? (
                            <Text variant="caption" className="font-body-semi" style={{ color: colors.brand.accent.error }}>
                                {error}
                            </Text>
                        ) : null}
                    </BottomSheetScrollView>

                    <View
                        style={[
                            styles.footer,
                            {
                                borderTopColor: colors.brand.bg.border,
                                paddingBottom: Math.max(insets.bottom, scale(12)),
                            },
                        ]}
                    >
                        <Pressable
                            onPress={save}
                            disabled={saving}
                            style={[
                                styles.saveBtn,
                                {
                                    backgroundColor: colors.chrome.primary,
                                    opacity: saving ? 0.65 : 1,
                                },
                            ]}
                        >
                            {saving ? <ActivityIndicator color="#FFFFFF" /> : null}
                            <Text variant="body" className="font-body-semi" style={{ color: '#FFFFFF' }}>
                                {saving ? t('please_wait', 'Please wait') : t('save', 'Save')}
                            </Text>
                        </Pressable>
                    </View>
                </BottomSheet>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: scale(10),
        paddingHorizontal: scale(14),
        paddingBottom: scale(12),
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    iconWrap: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(12),
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtn: {
        width: scale(32),
        height: scale(32),
        borderRadius: scale(16),
        alignItems: 'center',
        justifyContent: 'center',
    },
    option: {
        minHeight: scale(46),
        borderRadius: scale(12),
        borderWidth: 1,
        paddingHorizontal: scale(12),
        paddingVertical: scale(10),
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(8),
    },
    otherInput: {
        marginTop: scale(4),
        borderWidth: 1,
        borderRadius: scale(10),
        minHeight: scale(48),
        paddingHorizontal: scale(12),
        fontSize: scale(16),
    },
    footer: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: scale(14),
        paddingTop: scale(12),
    },
    saveBtn: {
        minHeight: scale(48),
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: scale(8),
    },
});
