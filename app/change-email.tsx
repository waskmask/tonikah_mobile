import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { EmailSuggestionInput } from '@/components/ui/EmailSuggestionInput';
import { GradientButton } from '@/components/ui/GradientButton';
import { SectionCard } from '@/components/ui/SectionCard';
import { Text } from '@/components/ui/Text';
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
            <AppBackTitleBar title={t('change_email', 'Change Email Address')} fallbackHref="/settings-account" />
            <KeyboardAwareScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                bottomOffset={scale(24)}
            >
                <SectionCard title={t('change_email', 'Change Email Address')}>
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

                    <View style={[styles.currentEmail, { backgroundColor: colors.brand.bg.surface, borderColor: colors.brand.bg.border }]}>
                        <Text variant="caption" className="font-body-semi" style={{ color: colors.brand.text.subtitle }}>
                            {t('account_email', 'Account email')}
                        </Text>
                        <Text
                            variant="body-sm"
                            className="font-body-semi"
                            selectable
                            style={styles.emailText}
                        >
                            {user?.email || ''}
                        </Text>
                    </View>

                    <EmailSuggestionInput
                        label={t('change_email', 'Change Email Address')}
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
                        error={touched && errorKey ? t(errorKey, errorKey) : undefined}
                        containerStyle="mb-6"
                    />

                    <GradientButton
                        title={saving ? t('please_wait', 'Please wait...') : t('update_email', 'Update Email Address')}
                        onPress={submit}
                        loading={saving}
                        disabled={saving || !normalizedEmail}
                        widthMode="full"
                        height={44}
                        textSize={14}
                    />
                </SectionCard>
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
        paddingHorizontal: scale(14),
        paddingTop: scale(18),
    },
    status: {
        borderRadius: scale(8),
        borderWidth: 1,
        marginBottom: scale(14),
        paddingHorizontal: scale(12),
        paddingVertical: scale(10),
    },
    currentEmail: {
        borderRadius: scale(8),
        borderWidth: 1,
        marginBottom: scale(18),
        paddingHorizontal: scale(12),
        paddingVertical: scale(11),
    },
    emailText: {
        marginTop: scale(4),
        textAlign: 'left',
        writingDirection: 'ltr',
    },
});
