import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { router } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';

import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { GradientButton } from '@/components/ui/GradientButton';
import { Input } from '@/components/ui/Input';
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

export default function SetPasswordScreen() {
    const user = useAuthStore((state) => state.user);
    const refreshUser = useAuthStore((state) => state.refreshUser);
    const colors = useColors();
    const { isRTL } = useLanguage();
    const toast = useToast();

    const googleConnected = Boolean(user?.googleId);
    const hasPassword = Boolean(user?.hasPassword);

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [touched, setTouched] = useState({ password: false, confirm: false });
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<Status>(null);

    useEffect(() => {
        if (!user) return;
        if (!googleConnected || hasPassword) {
            router.replace('/settings-security' as any);
        }
    }, [googleConnected, hasPassword, user]);

    const cleanPassword = password.replace(/\s+/g, '');
    const cleanConfirm = confirmPassword.replace(/\s+/g, '');

    const errors = useMemo(() => {
        const next: { password?: string; confirm?: string } = {};
        if (!cleanPassword) next.password = 'password_required';
        else if (cleanPassword.length < 8) next.password = 'password_min_8';
        else if (cleanPassword.length > 30) next.password = 'password_max_30';

        if (!cleanConfirm) next.confirm = 'confirm_password_required';
        else if (cleanPassword && cleanConfirm !== cleanPassword) next.confirm = 'passwords_do_not_match';
        return next;
    }, [cleanConfirm, cleanPassword]);

    const submit = async () => {
        setTouched({ password: true, confirm: true });
        setStatus(null);
        if (errors.password || errors.confirm || saving) return;

        setSaving(true);
        const result = await authService.createPassword(cleanPassword);
        setSaving(false);

        if (result.success) {
            const message = t(
                result.message || 'password_created',
                t('password_created', 'You have successfully added a login password to your account.'),
            );
            setStatus({ type: 'success', text: message });
            toast.show(message, 'success', 3500);
            await refreshUser();
            setTimeout(() => router.replace('/settings-security' as any), 1200);
            return;
        }

        const message = translateApiError(result.message || 'create_password_failed');
        setStatus({ type: 'error', text: message });
        toast.show(message, 'error', 3500);
    };

    const eye = (
        <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
            {showPassword
                ? <EyeOff size={scale(18)} color={colors.brand.text.muted} />
                : <Eye size={scale(18)} color={colors.brand.text.muted} />}
        </Pressable>
    );

    return (
        <View style={[styles.screen, { backgroundColor: colors.brand.bg.surface }]}>
            <AppBackTitleBar title={t('set_password', 'Set Login Password')} fallbackHref="/settings-security" />
            <KeyboardAwareScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                bottomOffset={scale(24)}
            >
                <SectionCard title={t('set_password', 'Set Login Password')}>
                    <Text variant="caption" style={{ color: colors.brand.text.subtitle, marginBottom: scale(8) }}>
                        {t('you_signed_up_with_google', 'You signed up with Google. Set a password to also login with email.')}
                    </Text>

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

                    <Input
                        label={t('set_password', 'Set Login Password')}
                        value={password}
                        onChangeText={(value) => {
                            setPassword(value.replace(/\s+/g, ''));
                            setStatus(null);
                        }}
                        onBlur={() => setTouched((current) => ({ ...current, password: true }))}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        rightIcon={eye}
                        error={touched.password && errors.password
                            ? t(errors.password, errors.password)
                            : undefined}
                    />
                    <Input
                        label={t('confirm_password', 'Confirm password')}
                        value={confirmPassword}
                        onChangeText={(value) => {
                            setConfirmPassword(value.replace(/\s+/g, ''));
                            setStatus(null);
                        }}
                        onBlur={() => setTouched((current) => ({ ...current, confirm: true }))}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        rightIcon={eye}
                        error={touched.confirm && errors.confirm
                            ? t(errors.confirm, errors.confirm)
                            : undefined}
                    />

                    <GradientButton
                        title={saving ? t('please_wait', 'Please wait') : t('save', 'Save')}
                        onPress={submit}
                        loading={saving}
                        disabled={saving}
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
    screen: { flex: 1 },
    scroll: { flex: 1 },
    content: {
        paddingHorizontal: scale(14),
        paddingTop: scale(18),
        paddingBottom: scale(60),
    },
    status: {
        borderWidth: 1,
        borderRadius: scale(10),
        paddingHorizontal: scale(12),
        paddingVertical: scale(10),
        marginBottom: scale(10),
    },
});
