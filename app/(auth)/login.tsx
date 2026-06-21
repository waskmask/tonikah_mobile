import React, { useState } from 'react';
import { View, KeyboardAvoidingView, ScrollView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { GradientButton } from '@/components/ui/GradientButton';
import { LanguagePicker } from '@/components/ui/LanguagePicker';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
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
// If using custom modal, import it here

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
    const { isDark } = useTheme();
    const { login, googleAuth } = useAuthStore();
    const toast = useToast();

    const [showPassword, setShowPassword] = useState(false);
    const [isGoogleLoading, setGoogleLoading] = useState(false);

    const {
        control,
        handleSubmit,
        setError,
        formState: { errors, isValid, isSubmitting },
    } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
        mode: 'onChange',
        reValidateMode: 'onChange',
    });

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
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Header Row */}
                    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: scale(20), paddingTop: scale(16) }}>
                        <LanguagePicker />
                    </View>

                    {/* Content Area */}
                    <View className="px-6 items-center flex-1">
                        <Text variant="h2" className="mt-8 text-center">
                            {t('login')}
                        </Text>

                        {/* Email Field */}
                        <View className="w-full mt-8">
                            <Controller
                                control={control}
                                name="email"
                                render={({ field: { onChange, onBlur, value } }) => (
                                    <Input
                                        placeholder={t('enter_email')}
                                        leftIcon={<Mail size={scale(20)} color={isDark ? '#9CA3AF' : '#6B7280'} />}
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
                        <View className="w-full mt-4">
                            <Controller
                                control={control}
                                name="password"
                                render={({ field: { onChange, onBlur, value } }) => (
                                    <Input
                                        placeholder={t('password')}
                                        leftIcon={<Lock size={scale(20)} color={isDark ? '#9CA3AF' : '#6B7280'} />}
                                        rightIcon={
                                            <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
                                                {showPassword ? (
                                                    <EyeOff size={scale(20)} color={isDark ? '#9CA3AF' : '#6B7280'} />
                                                ) : (
                                                    <Eye size={scale(20)} color={isDark ? '#9CA3AF' : '#6B7280'} />
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

                        {/* Forgot Password */}
                        <Pressable
                            style={{ marginTop: scale(8), alignSelf: isRTL ? 'flex-end' : 'flex-start' }}
                            onPress={() => router.push('/(auth)/forgot-pass')}
                        >
                            <Text className="text-[#4B68C4]">
                                {t('forgot_password')}?
                            </Text>
                        </Pressable>

                        {/* Submit Button */}
                        <View className="w-full mt-8 items-center">
                            <GradientButton
                                title={t('login')}
                                onPress={handleSubmit(onLogin)}
                                loading={isSubmitting}
                                disabled={!isValid || isSubmitting}
                                widthMode="full"
                            />
                        </View>

                        {/* Divider */}
                        <View className="flex-row items-center gap-4 mt-8 w-full">
                            <View className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
                            <Text variant="body-sm" className="text-gray-500 dark:text-gray-400">
                                {t('or')}
                            </Text>
                            <View className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
                        </View>

                        {/* Google Sign In */}
                        <Pressable
                            onPress={handleGoogleSignIn}
                            disabled={isGoogleLoading}
                            className="flex-row items-center justify-center w-full h-14 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 mt-6"
                        >
                            {isGoogleLoading ? (
                                <Text variant="body" className="text-gray-900 dark:text-white">
                                    {t('please_wait')}
                                </Text>
                            ) : (
                                <>
                                    <Image
                                        source={require('@/assets/images/google-icon.png')}
                                        style={{ width: scale(24), height: scale(24) }}
                                    />
                                    <Text variant="body" className="ms-3 text-gray-900 dark:text-white font-body-semi">
                                        {t('login_with_google')}
                                    </Text>
                                </>
                            )}
                        </Pressable>

                        <GoogleConsentNotice />

                        {/* Footer */}
                        <View className="flex-row justify-center items-center gap-1 mt-auto pb-8 pt-8">
                            <Text variant="body">
                                {t('dont_have_an_account')}?
                            </Text>
                            <Pressable onPress={() => router.push('/(auth)/signup')}>
                                <Text variant="body" className="text-[#4B68C4] font-body-semi">
                                    {t('create_new_account')}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
