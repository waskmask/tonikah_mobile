import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { EmailSuggestionInput } from '@/components/ui/EmailSuggestionInput';
import { GradientButton } from '@/components/ui/GradientButton';
import { AuthTopBar } from '@/components/auth/AuthTopBar';
import { Eye, EyeOff } from 'lucide-react-native';
import { useLanguage } from '@/hooks/useLanguage';
import { useColors } from '@/hooks/useColors';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { scale } from '@/hooks/useResponsive';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { translateApiError } from '@/lib/apiErrorTranslator';
import { GoogleConsentNotice } from '@/components/auth/GoogleConsentNotice';
import { PressableScale } from '@/components/ui/PressableScale';

const loginSchema = z.object({
    email: z
        .string()
        .min(1, 'email_required')
        .email('invalid_email'),
    password: z
        .string()
        .min(1, 'password_required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
    const { t, isRTL, currentLanguage } = useLanguage();
    const colors = useColors();
    const reduceMotion = useReducedMotion();
    const iconMuted = colors.brand.text.muted;
    const { login, googleAuth } = useAuthStore();
    const toast = useToast();

    const [showPassword, setShowPassword] = useState(false);
    const [isGoogleLoading, setGoogleLoading] = useState(false);

    const {
        control,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
        // Validate on blur first; once a field has erred, revalidate as the
        // user types so the message clears while they fix it.
        mode: 'onTouched',
        reValidateMode: 'onChange',
    });

    // Staggered entrance; disabled entirely for reduce-motion users
    const entering = (delay: number) =>
        reduceMotion ? undefined : FadeInDown.duration(350).delay(delay);

    const onLogin = async (data: LoginForm) => {
        const result = await login(data.email.toLowerCase().trim(), data.password);

        if (result.success) {
            router.replace('/');
            return;
        }

        if (result.message === 'email_not_verified') {
            toast.show(t('verify_email_browse_limit_message'), 'info');
            return;
        }

        if (result.message === 'invalid_credentials') {
            setError('email', { message: ' ' }); // visually highlight field without a string msg
            setError('password', { message: t('invalid_credentials') });
            return;
        }

        // Generic error
        const errorMsg = translateApiError(
            result.message,
            result.retryAfter ? { retryAfter: result.retryAfter } : undefined
        );
        toast.show(errorMsg, 'error');
    };

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        const result = await googleAuth({
            agreed: true,
            marketing_opt_in: false,
            lang: currentLanguage,
        });
        setGoogleLoading(false);

        if (result.success) {
            router.replace('/');
            return;
        }

        if (result.cancelled) return;

        if (result.message === 'consent_required') {
            toast.show(t('consent_required'), 'error');
            return;
        }

        const errorMsg = translateApiError(result.message || 'unknown_error');
        toast.show(errorMsg, 'error');
    };

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.brand.bg.primary }}>
                <KeyboardAwareScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                    bottomOffset={scale(24)}
                >
                    <AuthTopBar
                        leftLabel={t('sign_up')}
                        onLeftPress={() => router.push('/(auth)/signup')}
                    />

                    {/* Content Area */}
                    <View className="px-8 items-center flex-1 pb-10">
                        {/* Brand header */}
                        <Animated.View entering={entering(0)} style={{ width: '100%', alignItems: 'center' }}>
                            <Text variant="h2" className="mt-8 text-center">
                                {t('welcome_back', 'Welcome back')}
                            </Text>
                            <Text
                                variant="body-sm"
                                className="mt-2 text-center"
                                style={{ color: colors.brand.text.subtitle }}
                            >
                                {t('login_subtitle', 'Sign in to continue your journey')}
                            </Text>
                        </Animated.View>

                        {/* Form */}
                        {/* zIndex keeps the email suggestion dropdown above the Actions section */}
                        <Animated.View entering={entering(80)} style={{ width: '100%', zIndex: 30 }}>
                            {/* Email Field — suggestion dropdown must overlay the password field */}
                            <View className="w-full mt-8" style={{ zIndex: 30 }}>
                                <Controller
                                    control={control}
                                    name="email"
                                    render={({ field: { onChange, onBlur, value } }) => (
                                        <EmailSuggestionInput
                                            placeholder={t('enter_email')}
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

                            {/* Password Field */}
                            <View className="w-full mt-2">
                                <Controller
                                    control={control}
                                    name="password"
                                    render={({ field: { onChange, onBlur, value } }) => (
                                        <Input
                                            placeholder={t('password')}
                                            rightIcon={
                                                <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
                                                    {showPassword ? (
                                                        <EyeOff size={scale(20)} color={iconMuted} />
                                                    ) : (
                                                        <Eye size={scale(20)} color={iconMuted} />
                                                    )}
                                                </Pressable>
                                            }
                                            secureTextEntry={!showPassword}
                                            autoComplete="password"
                                            textContentType="password"
                                            value={value}
                                            onChangeText={onChange}
                                            onBlur={onBlur}
                                            error={errors.password?.message ? t(errors.password.message as any) : undefined}
                                        />
                                    )}
                                />
                            </View>

                            {/* Forgot Password — end-aligned per platform convention */}
                            <Pressable
                                hitSlop={10}
                                style={{ marginTop: scale(6), alignSelf: isRTL ? 'flex-start' : 'flex-end' }}
                                onPress={() => router.push('/(auth)/forgot-pass')}
                            >
                                <Text
                                    variant="body-sm"
                                    className="font-body-medium"
                                    style={{ color: colors.brand.accent.link, paddingVertical: scale(4) }}
                                >
                                    {t('forgot_password')}?
                                </Text>
                            </Pressable>
                        </Animated.View>

                        {/* Actions */}
                        <Animated.View entering={entering(160)} style={{ width: '100%', alignItems: 'center' }}>
                            {/* Submit Button */}
                            <View className="w-full mt-6 items-center">
                                <GradientButton
                                    title={t('login')}
                                    onPress={handleSubmit(onLogin)}
                                    loading={isSubmitting}
                                    disabled={isSubmitting}
                                    widthMode="full"
                                    height={40}
                                    textSize={15}
                                />
                            </View>

                            {/* Divider */}
                            <View className="flex-row items-center gap-4 mt-10 w-full">
                                <View className="flex-1 h-px" style={{ backgroundColor: colors.brand.bg.border }} />
                                <Text variant="body-sm" style={{ color: colors.brand.text.subtitle }}>
                                    {t('or')}
                                </Text>
                                <View className="flex-1 h-px" style={{ backgroundColor: colors.brand.bg.border }} />
                            </View>

                            {/* Google Sign In — same height + pill shape as the login button.
                                Static style: function-form Pressable styles lose backgrounds
                                under the NativeWind interop */}
                            <PressableScale
                                onPress={handleGoogleSignIn}
                                disabled={isGoogleLoading}
                                activeScale={0.98}
                                containerStyle={{ width: '100%', marginTop: scale(24) }}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '100%',
                                    height: scale(40),
                                    borderRadius: scale(20),
                                    borderWidth: 1,
                                    borderColor: colors.brand.bg.border,
                                    backgroundColor: colors.chrome.common.card,
                                }}
                            >
                                {isGoogleLoading ? (
                                    <Text variant="body" style={{ fontSize: scale(15) }}>
                                        {t('please_wait')}
                                    </Text>
                                ) : (
                                    <>
                                        <Image
                                            source={require('@/assets/images/google-icon.png')}
                                            style={{ width: scale(18), height: scale(18) }}
                                        />
                                        <Text variant="body" className="ms-3 font-body-semi" style={{ fontSize: scale(15) }}>
                                            {t('login_with_google')}
                                        </Text>
                                    </>
                                )}
                            </PressableScale>

                            {/* Breathing room between the button and the legal fine print */}
                            <View style={{ width: '100%', marginTop: scale(14) }}>
                                <GoogleConsentNotice />
                            </View>
                        </Animated.View>

                    </View>
                </KeyboardAwareScrollView>
        </SafeAreaView>
    );
}
