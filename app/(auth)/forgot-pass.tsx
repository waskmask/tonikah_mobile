import React, { useState, useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MailCheck } from 'lucide-react-native';
import { useLanguage } from '@/hooks/useLanguage';
import { useColors } from '@/hooks/useColors';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { scale } from '@/hooks/useResponsive';
import { Text } from '@/components/ui/Text';
import { EmailSuggestionInput } from '@/components/ui/EmailSuggestionInput';
import { GradientButton } from '@/components/ui/GradientButton';
import { AuthTopBar } from '@/components/auth/AuthTopBar';
import { authService } from '@/lib/authService';
import { translateApiError } from '@/lib/apiErrorTranslator';
import { useToast } from '@/hooks/useToast';

const forgotPassSchema = z.object({
    email: z
        .string()
        .min(1, 'email_required')
        .email('invalid_email'),
});

type ForgotPassForm = z.infer<typeof forgotPassSchema>;

export default function ForgotPassScreen() {
    const { t } = useLanguage();
    const colors = useColors();
    const reduceMotion = useReducedMotion();
    const toast = useToast();
    const [sentEmail, setSentEmail] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState(0);
    const [isResending, setIsResending] = useState(false);

    const {
        control,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<ForgotPassForm>({
        resolver: zodResolver(forgotPassSchema),
        // Validate on blur first; revalidate on change once a field has erred
        mode: 'onTouched',
        reValidateMode: 'onChange',
    });

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setInterval(() => setCooldown(c => c - 1), 1000);
        return () => clearInterval(timer);
    }, [cooldown]);

    const entering = (delay: number) =>
        reduceMotion ? undefined : FadeInDown.duration(350).delay(delay);

    const onSubmit = async (data: ForgotPassForm) => {
        const email = data.email.toLowerCase().trim();
        const result = await authService.requestPasswordReset(email);

        if (result.success) {
            setSentEmail(email);
            setCooldown(60);
            return;
        }

        toast.show(translateApiError(result.message || 'reset_request_failed'), 'error');
    };

    const handleResend = async () => {
        if (!sentEmail || isResending || cooldown > 0) return;

        setIsResending(true);
        const result = await authService.requestPasswordReset(sentEmail);
        setIsResending(false);

        if (result.success) {
            setCooldown(60);
            return;
        }

        toast.show(translateApiError(result.message || 'reset_request_failed'), 'error');
    };

    const loginCta = (delay: number) => (
        <Animated.View
            entering={entering(delay)}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: scale(40),
            }}
        >
            <Text variant="body" style={{ color: colors.brand.text.subtitle }}>
                {t('already_have_an_account')}{' '}
            </Text>
            <Pressable hitSlop={10} onPress={() => router.push('/(auth)/login')}>
                <Text
                    variant="body"
                    className="font-body-semi"
                    style={{ color: colors.chrome.primary, paddingVertical: scale(4) }}
                >
                    {t('login')}
                </Text>
            </Pressable>
        </Animated.View>
    );

    if (sentEmail) {
        return (
            <SafeAreaView className="flex-1" style={{ backgroundColor: colors.brand.bg.primary }}>
                <AuthTopBar
                    leftLabel={t('login')}
                    onLeftPress={() => router.push('/(auth)/login')}
                />

                <View className="flex-1 px-8 pb-10">
                    <Animated.View entering={entering(0)} className="flex-1 justify-center items-center">
                        <View
                            className="items-center justify-center p-6 rounded-full mb-6"
                            style={{ backgroundColor: colors.chrome.common.primaryTint }}
                        >
                            <MailCheck size={scale(64)} color={colors.chrome.primary} strokeWidth={1.5} />
                        </View>

                        <Text variant="h3" className="text-center mt-2">
                            {t('reset_check_email_title')}
                        </Text>

                        <Text
                            variant="body"
                            className="text-center mt-4 leading-6 px-4"
                            style={{ color: colors.brand.text.subtitle }}
                        >
                            {t('reset_email_sent_if_exists')}
                        </Text>

                        <View
                            className="px-4 py-2 rounded-full mt-6"
                            style={{ backgroundColor: colors.brand.bg.surface }}
                        >
                            <Text variant="body-sm" className="font-body-semi text-center">
                                {sentEmail}
                            </Text>
                        </View>

                        <View className="mt-8">
                            {cooldown > 0 ? (
                                <Text
                                    variant="body"
                                    className="text-center"
                                    style={{ color: colors.brand.text.muted }}
                                >
                                    {t('resend_cooldown_in', { seconds: cooldown })}
                                </Text>
                            ) : (
                                <Pressable
                                    onPress={handleResend}
                                    disabled={isResending}
                                    hitSlop={10}
                                    className="flex-row justify-center items-center pt-2 pb-2"
                                >
                                    <Text
                                        variant="body"
                                        className="text-center font-body-semi"
                                        style={{
                                            color: isResending
                                                ? colors.brand.text.muted
                                                : colors.brand.accent.link,
                                        }}
                                    >
                                        {isResending ? t('sending') : t('resend_reset_link')}
                                    </Text>
                                </Pressable>
                            )}
                        </View>
                    </Animated.View>

                    {loginCta(80)}
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.brand.bg.primary }}>
                <KeyboardAwareScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                    bottomOffset={scale(24)}
                >
                    <AuthTopBar
                        leftLabel={t('login')}
                        onLeftPress={() => router.push('/(auth)/login')}
                    />

                    <View className="px-8 items-center flex-1 pb-10">
                        {/* Header */}
                        <Animated.View entering={entering(0)} style={{ width: '100%', alignItems: 'center' }}>
                            <Text variant="h2" className="mt-8 text-center">
                                {t('forgot_password')}
                            </Text>
                            <Text
                                variant="body-sm"
                                className="mt-2 text-center"
                                style={{ color: colors.brand.text.subtitle }}
                            >
                                {t('forgot_password_sub')}
                            </Text>
                        </Animated.View>

                        <Animated.View entering={entering(80)} style={{ width: '100%', alignItems: 'center', zIndex: 30 }}>
                            <View className="w-full mt-8" style={{ zIndex: 30 }}>
                                <Controller
                                    control={control}
                                    name="email"
                                    render={({ field: { onChange, onBlur, value } }) => (
                                        <EmailSuggestionInput
                                            placeholder={t('email_address')}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            autoComplete="email"
                                            textContentType="emailAddress"
                                            value={value}
                                            onChangeText={onChange}
                                            onBlur={onBlur}
                                            error={errors.email?.message ? t(errors.email.message as any) : undefined}
                                        />
                                    )}
                                />
                            </View>

                            <View className="w-full mt-6 items-center">
                                <GradientButton
                                    title={isSubmitting ? t('sending') : t('continue')}
                                    onPress={handleSubmit(onSubmit)}
                                    loading={isSubmitting}
                                    disabled={isSubmitting}
                                    widthMode="full"
                                    height={40}
                                    textSize={15}
                                />
                            </View>
                        </Animated.View>

                        {/* Push the login CTA to the bottom on tall screens */}
                        <View className="flex-1" />

                        {/* Back to login */}
                        {loginCta(160)}
                    </View>
                </KeyboardAwareScrollView>
        </SafeAreaView>
    );
}
