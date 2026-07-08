import React, { useState } from 'react';
import { View, Pressable, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { EmailSuggestionInput } from '@/components/ui/EmailSuggestionInput';
import { GradientButton } from '@/components/ui/GradientButton';
import { Checkbox } from '@/components/ui/Checkbox';
import { AuthTopBar } from '@/components/auth/AuthTopBar';
import { PressableScale } from '@/components/ui/PressableScale';
import { Eye, EyeOff } from 'lucide-react-native';
import { useLanguage } from '@/hooks/useLanguage';
import { useColors } from '@/hooks/useColors';
import { useReducedMotion } from '@/hooks/useReducedMotion';
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
    const { t, currentLanguage } = useLanguage();
    const colors = useColors();
    const reduceMotion = useReducedMotion();
    const iconMuted = colors.brand.text.muted;
    const { signup, googleAuth } = useAuthStore();
    const toast = useToast();

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isGoogleLoading, setGoogleLoading] = useState(false);
    // Consent modal shown when Google is tapped before the terms box is ticked
    const [consentModalOpen, setConsentModalOpen] = useState(false);
    const [modalAgreed, setModalAgreed] = useState(false);
    const [modalMarketing, setModalMarketing] = useState(false);
    const consentParts = getConsentParts(String(t('consent_statement')));

    const {
        control,
        handleSubmit,
        setError,
        setValue,
        formState: { errors, isSubmitting },
        watch,
    } = useForm<SignupForm>({
        resolver: zodResolver(signupSchema),
        // Validate on blur first; revalidate on change once a field has erred
        mode: 'onTouched',
        reValidateMode: 'onChange',
        defaultValues: {
            agreed: false,
            marketingOptIn: false,
        }
    });

    const entering = (delay: number) =>
        reduceMotion ? undefined : FadeInDown.duration(350).delay(delay);

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

    const startGoogleAuth = async (marketingOptIn: boolean) => {
        setGoogleLoading(true);
        const result = await googleAuth({
            agreed: true,
            marketing_opt_in: marketingOptIn,
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

    const handleGooglePress = () => {
        // Terms already accepted on the page → no modal needed
        if (watch('agreed')) {
            void startGoogleAuth(!!watch('marketingOptIn'));
            return;
        }
        setModalAgreed(false);
        setModalMarketing(!!watch('marketingOptIn'));
        setConsentModalOpen(true);
    };

    const confirmConsent = () => {
        // Reflect the modal choices back into the page checkboxes
        setValue('agreed', true, { shouldValidate: true });
        setValue('marketingOptIn', modalMarketing);
        setConsentModalOpen(false);
        void startGoogleAuth(modalMarketing);
    };

    const openTerms = () => WebBrowser.openBrowserAsync(Config.TERMS_URL);
    const openPrivacy = () => WebBrowser.openBrowserAsync(Config.PRIVACY_URL);

    // Shared between the page checkbox and the Google consent modal
    const consentLabel = (
        <>
            <Text variant="body-sm" style={{ color: colors.brand.text.subtitle }}>
                {consentParts.beforeTerms}
            </Text>
            {consentParts.termsLabel ? (
                <Pressable onPress={openTerms} hitSlop={5}>
                    <Text variant="body-sm" className="font-body-semi underline mx-1" style={{ color: colors.brand.accent.link }}>
                        {consentParts.termsLabel}
                    </Text>
                </Pressable>
            ) : null}
            <Text variant="body-sm" className="mt-1" style={{ color: colors.brand.text.subtitle }}>
                {consentParts.betweenLinks}
            </Text>
            {consentParts.privacyLabel ? (
                <Pressable onPress={openPrivacy} hitSlop={5}>
                    <Text variant="body-sm" className="font-body-semi underline mx-1" style={{ color: colors.brand.accent.link }}>
                        {consentParts.privacyLabel}
                    </Text>
                </Pressable>
            ) : null}
            <Text variant="body-sm" className="mt-1" style={{ color: colors.brand.text.subtitle }}>
                {consentParts.afterPrivacy}
            </Text>
        </>
    );

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

                    {/* Content Area */}
                    <View className="px-8 items-center flex-1 pb-10">
                        {/* Header */}
                        <Animated.View entering={entering(0)} style={{ width: '100%', alignItems: 'center' }}>
                            <Text variant="h2" className="mt-8 text-center">
                                {t('join_tonikah')}
                            </Text>
                            <Text
                                variant="body-sm"
                                className="mt-2 text-center"
                                style={{ color: colors.brand.text.subtitle }}
                            >
                                {t('singup_desc')}
                            </Text>
                        </Animated.View>

                        {/* Google first: the fastest path for a brand-new user */}
                        <Animated.View entering={entering(80)} style={{ width: '100%', alignItems: 'center' }}>
                            {/* Static style: function-form Pressable styles lose backgrounds
                                under the NativeWind interop */}
                            <PressableScale
                                onPress={handleGooglePress}
                                disabled={isGoogleLoading}
                                activeScale={0.98}
                                containerStyle={{ width: '100%', marginTop: scale(32) }}
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
                                            {t('sign_in_with_google')}
                                        </Text>
                                    </>
                                )}
                            </PressableScale>

                            {/* No fine print here: the terms checkbox below is the single
                                consent statement for this screen */}

                            {/* Divider */}
                            <View className="flex-row items-center gap-4 mt-8 w-full">
                                <View className="flex-1 h-px" style={{ backgroundColor: colors.brand.bg.border }} />
                                <Text variant="body-sm" style={{ color: colors.brand.text.subtitle }}>
                                    {t('or')}
                                </Text>
                                <View className="flex-1 h-px" style={{ backgroundColor: colors.brand.bg.border }} />
                            </View>
                        </Animated.View>

                        {/* Email form — zIndex keeps the suggestion dropdown above later sections */}
                        <Animated.View entering={entering(160)} style={{ width: '100%', zIndex: 30 }}>
                            {/* Email Field — suggestion dropdown must overlay the password field */}
                            <View className="w-full mt-6" style={{ zIndex: 30 }}>
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
                            <View className="w-full mt-2">
                                <Controller
                                    control={control}
                                    name="confirmPassword"
                                    render={({ field: { onChange, onBlur, value } }) => (
                                        <Input
                                            placeholder={t('confirm_password')}
                                            rightIcon={
                                                <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} hitSlop={10}>
                                                    {showConfirmPassword ? (
                                                        <EyeOff size={scale(20)} color={iconMuted} />
                                                    ) : (
                                                        <Eye size={scale(20)} color={iconMuted} />
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
                                            label={consentLabel}
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
                                    disabled={isSubmitting}
                                    widthMode="full"
                                    height={40}
                                    textSize={15}
                                />
                            </View>
                        </Animated.View>

                    </View>
                </KeyboardAwareScrollView>

            {/* Google consent modal — shown when the terms box isn't ticked yet */}
            <Modal
                visible={consentModalOpen}
                transparent
                animationType="none"
                statusBarTranslucent
                hardwareAccelerated
                onRequestClose={() => setConsentModalOpen(false)}
            >
                <Animated.View entering={FadeIn.duration(120)} style={modalStyles.overlay}>
                    <Pressable style={modalStyles.backdrop} onPress={() => setConsentModalOpen(false)}>
                        <Animated.View entering={FadeInDown.duration(180)} style={{ width: '100%', alignItems: 'center' }}>
                            <Pressable
                                onPress={() => undefined}
                                style={[
                                    modalStyles.card,
                                    {
                                        backgroundColor: colors.chrome.common.card,
                                        borderColor: colors.brand.bg.border,
                                    },
                                ]}
                            >
                                <Text variant="heading-sm" className="text-center">
                                    {t('consent_required')}
                                </Text>

                                <View style={{ marginTop: scale(18) }}>
                                    <Checkbox
                                        checked={modalAgreed}
                                        onChange={setModalAgreed}
                                        label={consentLabel}
                                    />
                                </View>

                                <View style={{ marginTop: scale(14) }}>
                                    <Checkbox
                                        checked={modalMarketing}
                                        onChange={setModalMarketing}
                                        label={t('marketing_opt_statement')}
                                    />
                                </View>

                                <View style={{ marginTop: scale(22), width: '100%' }}>
                                    <GradientButton
                                        title={t('continue')}
                                        onPress={confirmConsent}
                                        disabled={!modalAgreed}
                                        widthMode="full"
                                        height={40}
                                        textSize={15}
                                    />
                                </View>

                                <Pressable
                                    hitSlop={10}
                                    onPress={() => setConsentModalOpen(false)}
                                    style={{ marginTop: scale(14), alignSelf: 'center' }}
                                >
                                    <Text variant="body-sm" className="font-body-medium" style={{ color: colors.brand.text.subtitle }}>
                                        {t('cancel')}
                                    </Text>
                                </Pressable>
                            </Pressable>
                        </Animated.View>
                    </Pressable>
                </Animated.View>
            </Modal>
        </SafeAreaView>
    );
}

const modalStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    backdrop: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(24),
    },
    card: {
        width: '100%',
        maxWidth: scale(360),
        borderRadius: scale(18),
        borderWidth: 1,
        paddingHorizontal: scale(20),
        paddingVertical: scale(22),
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 10 },
        elevation: 12,
    },
});
