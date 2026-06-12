import React, { useState } from 'react';
import { View, KeyboardAvoidingView, ScrollView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { GradientButton } from '@/components/ui/GradientButton';
import { LanguagePicker } from '@/components/ui/LanguagePicker';
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
    const { t, isRTL } = useLanguage();
    const { isDark } = useTheme();
    const toast = useToast();
    const [sent, setSent] = useState(false);

    const {
        control,
        handleSubmit,
        formState: { errors, isValid, isSubmitting },
    } = useForm<ForgotPassForm>({
        resolver: zodResolver(forgotPassSchema),
        mode: 'onChange',
        reValidateMode: 'onChange',
    });

    const onSubmit = async (data: ForgotPassForm) => {
        const result = await authService.requestPasswordReset(data.email.toLowerCase().trim());

        if (result.success) {
            setSent(true);
            return;
        }

        toast.show(translateApiError(result.message || 'reset_request_failed'), 'error');
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
                    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: scale(20), paddingTop: scale(16) }}>
                        <LanguagePicker />
                    </View>

                    <View className="px-6 items-center flex-1">
                        <Text variant="h2" className="mt-8 text-center">
                            {sent ? t('reset_email_sent_if_exists') : t('forgot_password')}
                        </Text>
                        <Text variant="body" className="mt-2 text-gray-500 dark:text-gray-400 text-center">
                            {t('forgot_password_sub')}
                        </Text>

                        {!sent && (
                            <>
                                <View className="w-full mt-8">
                                    <Controller
                                        control={control}
                                        name="email"
                                        render={({ field: { onChange, onBlur, value } }) => (
                                            <Input
                                                placeholder={t('email_address')}
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

                                <View className="w-full mt-6 items-center">
                                    <GradientButton
                                        title={isSubmitting ? t('sending') : t('continue')}
                                        onPress={handleSubmit(onSubmit)}
                                        loading={isSubmitting}
                                        disabled={!isValid || isSubmitting}
                                        widthMode="full"
                                    />
                                </View>
                            </>
                        )}

                        <Pressable onPress={() => router.push('/(auth)/login')} className="mt-8">
                            <Text variant="body" className="text-[#4B68C4] font-body-semi">
                                {t('login')}
                            </Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
