import React, { useState, useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { Mail } from 'lucide-react-native';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { router, useLocalSearchParams } from 'expo-router';
import { authService } from '@/lib/authService';
import { useToast } from '@/hooks/useToast';

export default function VerifyEmailScreen() {
    const { t } = useLanguage();
    const toast = useToast();
    const { email } = useLocalSearchParams<{ email: string }>();

    const [cooldown, setCooldown] = useState(0);
    const [isResending, setIsResending] = useState(false);

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setInterval(() => setCooldown(c => c - 1), 1000);
        return () => clearInterval(timer);
    }, [cooldown]);

    const handleResend = async () => {
        if (!email) return;

        setIsResending(true);
        const result = await authService.resendVerification(email);
        setIsResending(false);

        if (result.success) {
            toast.show(t('auth.resend_success'), 'success');
            setCooldown(60);
        } else {
            toast.show(t('api_errors.server_error_default'), 'error');
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900 justify-center items-center px-6">

            <View className="items-center justify-center p-6 bg-[#FE8A7B]/10 rounded-full mb-6">
                <Mail size={scale(64)} color="#FE8A7B" strokeWidth={1.5} />
            </View>

            <Text variant="h3" className="text-center mt-2">
                {t('auth.verify_title')}
            </Text>

            <Text variant="body" className="text-center text-gray-500 dark:text-gray-400 mt-4 leading-6 px-4">
                {t('auth.verify_body')}
            </Text>

            <View className="bg-gray-100 dark:bg-slate-800 px-4 py-2 rounded-full mt-6">
                <Text variant="body-sm" className="font-body-semi text-center text-gray-900 dark:text-white">
                    {email || 'your-email@example.com'}
                </Text>
            </View>

            <View className="w-full max-w-[300px] mt-10">
                <GradientButton
                    title={t('auth.go_to_login')}
                    onPress={() => router.replace('/(auth)/login')}
                    widthMode="full"
                />
            </View>

            <View className="mt-8">
                {cooldown > 0 ? (
                    <Text variant="body" className="text-gray-400 dark:text-gray-500 text-center">
                        {t('auth.resend_cooldown', { seconds: cooldown })}
                    </Text>
                ) : (
                    <Pressable
                        onPress={handleResend}
                        disabled={isResending}
                        hitSlop={10}
                        className="flex-row justify-center items-center pt-2 pb-2"
                    >
                        <Text variant="body" className={`text-center font-body-semi ${isResending ? 'text-gray-400' : 'text-[#4B68C4]'}`}>
                            {t('auth.resend_verification')}
                        </Text>
                    </Pressable>
                )}
            </View>

        </SafeAreaView>
    );
}
