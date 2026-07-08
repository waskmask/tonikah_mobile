import React, { useState, useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { AuthTopBar } from '@/components/auth/AuthTopBar';
import { Mail, RefreshCw } from 'lucide-react-native';
import { useLanguage } from '@/hooks/useLanguage';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';
import { router, useLocalSearchParams } from 'expo-router';
import { authService } from '@/lib/authService';
import { useToast } from '@/hooks/useToast';
import { useAuthStore } from '@/store/authStore';

export default function VerifyEmailScreen() {
    const { t } = useLanguage();
    const colors = useColors();
    const link = colors.brand.accent.link;
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
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.brand.bg.primary }}>
            <AuthTopBar />

            <View className="flex-1 justify-center items-center px-6">

            <View className="items-center justify-center p-6 rounded-full mb-6" style={{ backgroundColor: colors.chrome.common.primaryTint }}>
                <Mail size={scale(64)} color={colors.chrome.primary} strokeWidth={1.5} />
            </View>

            <Text variant="h3" className="text-center mt-2">
                {t('auth.verify_title')}
            </Text>

            <Text variant="body" className="text-center mt-4 leading-6 px-4" style={{ color: colors.brand.text.subtitle }}>
                {t('auth.verify_body')}
            </Text>

            <View className="px-4 py-2 rounded-full mt-6" style={{ backgroundColor: colors.brand.bg.surface }}>
                <Text variant="body-sm" className="font-body-semi text-center">
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
                    <RefreshCw size={scale(16)} color={isRefreshing ? colors.brand.text.muted : link} />
                    <Text variant="body" className="text-center font-body-semi" style={{ color: isRefreshing ? colors.brand.text.muted : link }}>
                        {isRefreshing ? t('please_wait') : t('verify_email')}
                    </Text>
                </Pressable>
            ) : null}

            <View className="mt-8">
                {cooldown > 0 ? (
                    <Text variant="body" className="text-center" style={{ color: colors.brand.text.muted }}>
                        {t('auth.resend_cooldown', { seconds: cooldown })}
                    </Text>
                ) : (
                    <Pressable
                        onPress={handleResend}
                        disabled={isResending}
                        hitSlop={10}
                        className="flex-row justify-center items-center pt-2 pb-2"
                    >
                        <Text variant="body" className="text-center font-body-semi" style={{ color: isResending ? colors.brand.text.muted : link }}>
                            {t('auth.resend_verification')}
                        </Text>
                    </Pressable>
                )}
            </View>

            </View>
        </SafeAreaView>
    );
}
