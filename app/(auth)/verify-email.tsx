import React, { useState, useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { Mail, RefreshCw } from 'lucide-react-native';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { router, useLocalSearchParams } from 'expo-router';
import { authService } from '@/lib/authService';
import { useToast } from '@/hooks/useToast';
import { useAuthStore } from '@/store/authStore';

export default function VerifyEmailScreen() {
    const { t } = useLanguage();
    const toast = useToast();
    const { email } = useLocalSearchParams<{ email: string }>();
    const { refreshUser, user } = useAuthStore();

    const [cooldown, setCooldown] = useState(0);
    const [isResending, setIsResending] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

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

    const handleRefreshStatus = async () => {
        setIsRefreshing(true);
        const result = await refreshUser();
        setIsRefreshing(false);

        if (result.success && result.user?.email_verified) {
            toast.show(t('verification_email_sent'), 'success');
            router.replace('/');
            return;
        }

        toast.show(t('email_not_verified'), 'info');
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900 justify-center items-center px-6">

            <View className="items-center justify-center p-6 bg-[#F34B6F]/10 rounded-full mb-6">
                <Mail size={scale(64)} color="#F34B6F" strokeWidth={1.5} />
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
                    title={t('open_app')}
                    onPress={() => router.replace('/')}
                    widthMode="full"
                />
            </View>

            {user ? (
                <Pressable
                    onPress={handleRefreshStatus}
                    disabled={isRefreshing}
                    hitSlop={10}
                    className="flex-row justify-center items-center mt-5 pt-2 pb-2"
                    style={{ gap: scale(8) }}
                >
                    <RefreshCw size={scale(16)} color={isRefreshing ? '#9CA3AF' : '#4B68C4'} />
                    <Text variant="body" className={`text-center font-body-semi ${isRefreshing ? 'text-gray-400' : 'text-[#4B68C4]'}`}>
                        {isRefreshing ? t('please_wait') : t('verify_email')}
                    </Text>
                </Pressable>
            ) : null}

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
