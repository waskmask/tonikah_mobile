import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { SettingsFieldSection } from '@/components/settings/SettingsFieldSection';
import { SettingsInfoRow } from '@/components/settings/SettingsRows';
import { EmailSuggestionInput } from '@/components/ui/EmailSuggestionInput';
import { GradientButton } from '@/components/ui/GradientButton';
import { Text } from '@/components/ui/Text';
import { EnvelopeSimple } from 'phosphor-react-native';
import { useAuthStore } from '@/store/authStore';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { authService } from '@/lib/authService';
import { translateApiError } from '@/lib/apiErrorTranslator';
import { t } from '@/lib/profileDisplay';

type Status = { type: 'success' | 'error'; text: string } | null;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ChangeEmailScreen() {
    const user = useAuthStore((state) => state.user);
    const colors = useColors();
    const { currentLanguage, isRTL } = useLanguage();
    const toast = useToast();
    const [email, setEmail] = useState('');
    const [touched, setTouched] = useState(false);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<Status>(null);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCurrent = String(user?.email || '').trim().toLowerCase();
    const errorKey = useMemo(() => {
        if (!normalizedEmail) return 'email_required';
        if (!EMAIL_PATTERN.test(normalizedEmail)) return 'invalid_email';
        if (normalizedEmail === normalizedCurrent) return 'email_same_as_current';
        return '';
    }, [normalizedCurrent, normalizedEmail]);
    const fieldError = touched && errorKey ? t(errorKey, errorKey) : undefined;

    const submit = async () => {
        setTouched(true);
        setStatus(null);
        if (errorKey || saving) return;

        setSaving(true);
        const result = await authService.requestEmailChange({
            newEmail: normalizedEmail,
            lang: currentLanguage,
        });
        setSaving(false);

        if (result.success) {
            const message = t(
                result.message || 'change_email_verification_sent',
                t('change_email_verification_sent', 'A verification link was sent to your new email address.')
            );
            setStatus({ type: 'success', text: message });
            toast.show(message, 'success', 3500);
            return;
        }

        const message = translateApiError(result.message || 'change_email_request_failed');
        setStatus({ type: 'error', text: message });
        toast.show(message, 'error', 3500);
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.brand.bg.surface }]}>
            <AppBackTitleBar title={t('change_email_short', 'Change Email')} fallbackHref="/settings-account" showMenu />
            <KeyboardAwareScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                bottomOffset={scale(24)}
            >
                <SettingsFieldSection>
                    <SettingsInfoRow
                        icon={(
                            <EnvelopeSimple
                                size={scale(19)}
                                color={colors.chrome.common.textStrong}
                                weight="regular"
                            />
                        )}
                        label={t('account_email', 'Account email')}
                        value={user?.email || ''}
                    />
                </SettingsFieldSection>

                <SettingsFieldSection contentInset>
                    {status ? (
                        <View
                            style={[
                                styles.status,
                                {
                                    backgroundColor: status.type === 'success'
                                        ? colors.chrome.toast.success.bg
                                        : colors.chrome.toast.error.bg,
                                    borderColor: status.type === 'success'
                                        ? colors.chrome.toast.success.border
                                        : colors.chrome.toast.error.border,
                                },
                            ]}
                        >
                            <Text
                                variant="body-sm"
                                className="font-body-semi"
                                style={{
                                    color: status.type === 'success'
                                        ? colors.chrome.toast.success.text
                                        : colors.chrome.toast.error.text,
                                    textAlign: isRTL ? 'right' : 'left',
                                }}
                            >
                                {status.text}
                            </Text>
                        </View>
                    ) : null}

                    <View style={[styles.inputBlock, fieldError ? styles.inputBlockWithError : null]}>
                        <EmailSuggestionInput
                            label={t('new_email_address', 'New email address')}
                            placeholder={t('email_address', 'Email address')}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="email"
                            textContentType="emailAddress"
                            value={email}
                            onChangeText={(value) => {
                                setEmail(value);
                                setStatus(null);
                            }}
                            onBlur={() => setTouched(true)}
                            error={fieldError}
                        />
                    </View>

                    <Text
                        variant="caption"
                        style={[styles.hint, { color: colors.brand.text.subtitle, textAlign: isRTL ? 'right' : 'left' }]}
                    >
                        {t(
                            'change_email_verification_hint',
                            'We will send a verification link to the new address before changing your account email.',
                        )}
                    </Text>

                    <GradientButton
                        title={saving ? t('please_wait', 'Please wait...') : t('update_email', 'Update Email Address')}
                        onPress={submit}
                        loading={saving}
                        disabled={saving || !normalizedEmail}
                        widthMode="full"
                        size="compact"
                    />
                </SettingsFieldSection>
            </KeyboardAwareScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    scroll: {
        flex: 1,
    },
    content: {
        paddingBottom: scale(60),
        paddingTop: 0,
    },
    status: {
        borderRadius: scale(8),
        borderWidth: 1,
        marginTop: scale(16),
        marginBottom: scale(14),
        paddingHorizontal: scale(12),
        paddingVertical: scale(10),
    },
    hint: {
        marginBottom: scale(22),
        lineHeight: scale(18),
    },
    inputBlock: {
        marginBottom: scale(6),
    },
    inputBlockWithError: {
        marginBottom: scale(20),
    },
});
