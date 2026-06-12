import React, { useState } from 'react';
import { View, KeyboardAvoidingView, ScrollView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { GradientButton } from '@/components/ui/GradientButton';
import { Checkbox } from '@/components/ui/Checkbox';
import { LanguagePicker } from '@/components/ui/LanguagePicker';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Config } from '@/constants/config';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { translateApiError } from '@/lib/apiErrorTranslator';

const signupSchema = z.object({
    email: z
        .string()
        .min(1, 'email_required')
        .email('invalid_email'),
    password: z
        .string()
        .min(1, 'password_required'),
    confirmPassword: z
        .string()
        .min(1, 'confirm_password_required'),
    agreed: z
        .boolean()
        .refine(val => val === true, { message: 'consent_required' }),
    marketingOptIn: z.boolean().optional(),
}).refine(data => data.password === data.confirmPassword, {
    message: 'passwords_mismatch',
    path: ['confirmPassword'],
});

type SignupForm = z.infer<typeof signupSchema>;

function getConsentParts(consentStatement: string) {
    const match = consentStatement.match(/^(.*?)<a\b[^>]*>(.*?)<\/a>(.*?)<a\b[^>]*>(.*?)<\/a>(.*)$/i);
    if (!match) {
        return {
            beforeTerms: consentStatement,
            termsLabel: '',
            betweenLinks: '',
            privacyLabel: '',
            afterPrivacy: '',
        };
    }

    return {
        beforeTerms: match[1],
        termsLabel: match[2],
        betweenLinks: match[3],
        privacyLabel: match[4],
        afterPrivacy: match[5],
    };
}

export default function SignupScreen() {
    const { t, isRTL, currentLanguage } = useLanguage();
    const { isDark } = useTheme();
    const { signup, googleAuth } = useAuthStore();
    const toast = useToast();

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isGoogleLoading, setGoogleLoading] = useState(false);
    const consentParts = getConsentParts(String(t('consent_statement')));

    const {
        control,
        handleSubmit,
        setError,
        formState: { errors, isValid, isSubmitting },
    } = useForm<SignupForm>({
        resolver: zodResolver(signupSchema),
        mode: 'onChange',
        reValidateMode: 'onChange',
        defaultValues: {
            agreed: false,
            marketingOptIn: false,
        }
    });

    const onSignup = async (data: SignupForm) => {
        const result = await signup({
            email: data.email.toLowerCase().trim(),
            password: data.password,
            agreed: data.agreed,
            marketing_opt_in: !!data.marketingOptIn,
            lang: currentLanguage,
        });

        if (result.success) {
            toast.show(t('verify_email_browse_limit_message'), 'info');
            router.replace('/(profile-setup)/step1');
            return;
        }

        // Field-specific errors
        if (result.message === 'email_already_exists') {
            setError('email', { message: 'email_already_exists' });
            return;
        }
        if (result.message === 'consent_required') {
            setError('agreed', { message: 'consent_required' });
            return;
        }

        const errorMsg = translateApiError(
            result.message,
            result.retryAfter ? { retryAfter: result.retryAfter } : undefined
        );
        toast.show(errorMsg, 'error');
    };

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        const result = await googleAuth();
        setGoogleLoading(false);

        if (result.success) {
            router.replace('/');
            return;
        }

        if (result.cancelled) return;

        const errorMsg = translateApiError(result.message || 'unknown_error');
        toast.show(errorMsg, 'error');
    };

    const openTerms = () => WebBrowser.openBrowserAsync(Config.TERMS_URL);
    const openPrivacy = () => WebBrowser.openBrowserAsync(Config.PRIVACY_URL);

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
                        <Text variant="h2" className="mt-4 text-center">
                            {t('join_tonikah')}
                        </Text>
                        <Text variant="body" className="mt-1 text-gray-500 dark:text-gray-400 text-center">
                            {t('singup_desc')}
                        </Text>

                        {/* Email Field */}
                        <View className="w-full mt-6">
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
                                        textContentType="newPassword"
                                        value={value}
                                        onChangeText={onChange}
                                        onBlur={onBlur}
                                        error={errors.password?.message ? t(errors.password.message as any) : undefined}
                                    />
                                )}
                            />
                        </View>

                        {/* Confirm Password Field */}
                        <View className="w-full mt-4">
                            <Controller
                                control={control}
                                name="confirmPassword"
                                render={({ field: { onChange, onBlur, value } }) => (
                                    <Input
                                        placeholder={t('confirm_password')}
                                        leftIcon={<Lock size={scale(20)} color={isDark ? '#9CA3AF' : '#6B7280'} />}
                                        rightIcon={
                                            <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} hitSlop={10}>
                                                {showConfirmPassword ? (
                                                    <EyeOff size={scale(20)} color={isDark ? '#9CA3AF' : '#6B7280'} />
                                                ) : (
                                                    <Eye size={scale(20)} color={isDark ? '#9CA3AF' : '#6B7280'} />
                                                )}
                                            </Pressable>
                                        }
                                        secureTextEntry={!showConfirmPassword}
                                        autoComplete="password"
                                        textContentType="password"
                                        value={value}
                                        onChangeText={onChange}
                                        onBlur={onBlur}
                                        error={errors.confirmPassword?.message ? t(errors.confirmPassword.message as any) : undefined}
                                    />
                                )}
                            />
                        </View>

                        {/* Terms Checkbox */}
                        <View className="mt-5 w-full">
                            <Controller
                                control={control}
                                name="agreed"
                                render={({ field: { onChange, value } }) => (
                                    <Checkbox
                                        checked={value}
                                        onChange={onChange}
                                        error={errors.agreed?.message ? t(errors.agreed.message as any) : undefined}
                                        label={
                                            <>
                                                <Text variant="body-sm" className="text-gray-700 dark:text-gray-300">
                                                    {consentParts.beforeTerms}
                                                </Text>
                                                {consentParts.termsLabel ? (
                                                    <Pressable onPress={openTerms} hitSlop={5}>
                                                        <Text variant="body-sm" className="text-[#4B68C4] font-body-semi underline mx-1">
                                                            {consentParts.termsLabel}
                                                        </Text>
                                                    </Pressable>
                                                ) : null}
                                                <Text variant="body-sm" className="text-gray-700 dark:text-gray-300 mt-1">
                                                    {consentParts.betweenLinks}
                                                </Text>
                                                {consentParts.privacyLabel ? (
                                                    <Pressable onPress={openPrivacy} hitSlop={5}>
                                                        <Text variant="body-sm" className="text-[#4B68C4] font-body-semi underline mx-1">
                                                            {consentParts.privacyLabel}
                                                        </Text>
                                                    </Pressable>
                                                ) : null}
                                                <Text variant="body-sm" className="text-gray-700 dark:text-gray-300 mt-1">
                                                    {consentParts.afterPrivacy}
                                                </Text>
                                            </>
                                        }
                                    />
                                )}
                            />
                        </View>

                        {/* Marketing Checkbox */}
                        <View className="mt-4 w-full">
                            <Controller
                                control={control}
                                name="marketingOptIn"
                                render={({ field: { onChange, value } }) => (
                                    <Checkbox
                                        checked={value ?? false}
                                        onChange={onChange}
                                        label={t('marketing_opt_statement')}
                                    />
                                )}
                            />
                        </View>

                        {/* Submit Button */}
                        <View className="w-full mt-6 items-center">
                            <GradientButton
                                title={t('sign_up')}
                                onPress={handleSubmit(onSignup)}
                                loading={isSubmitting}
                                disabled={!isValid || isSubmitting}
                                widthMode="full"
                            />
                        </View>

                        {/* Divider */}
                        <View className="flex-row items-center gap-4 mt-6 w-full">
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
                                        {t('sign_in_with_google')}
                                    </Text>
                                </>
                            )}
                        </Pressable>

                        {/* Footer */}
                        <View className="flex-row justify-center items-center gap-1 mt-auto pb-8 pt-4">
                            <Text variant="body">
                                {t('already_have_an_account')}
                            </Text>
                            <Pressable onPress={() => router.push('/(auth)/login')}>
                                <Text variant="body" className="text-[#4B68C4] font-body-semi">
                                    {t('login_here')}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
