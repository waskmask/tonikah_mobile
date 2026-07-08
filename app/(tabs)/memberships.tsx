import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { GradientButton } from '@/components/ui/GradientButton';
import { membershipService } from '@/lib/membershipService';
import { apiMessage, t } from '@/lib/profileDisplay';
import { useEmailVerificationGuard } from '@/hooks/useEmailVerificationGuard';
import { useTheme } from '@/hooks/useTheme';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';

export default function MembershipsScreen() {
    const { isDark } = useTheme();
    const colors = useColors();
    const primary = colors.chrome.primary;
    const { requireVerified } = useEmailVerificationGuard();
    const toast = useToast();
    const [plans, setPlans] = useState<any[]>([]);
    const [membership, setMembership] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);

    useEffect(() => {
        (async () => {
            const [me, planRes] = await Promise.all([membershipService.me(), membershipService.plans()]);
            setMembership(me.membership || me.data?.membership || me);
            setPlans(planRes.plans || planRes.data?.plans || []);
            setLoading(false);
        })();
    }, []);

    const startTrial = async (plan: any) => {
        if (!requireVerified('checkout')) return;
        setStarting(true);
        const res = await membershipService.startTrial(plan.slug || plan.id || plan._id);
        if (res.success || res.ok) {
            toast.show(t('profile_updated_success', 'Profile updated successfully.'), 'success', 3000);
        } else {
            Alert.alert(t('error', 'Error'), apiMessage(res.message));
        }
        setStarting(false);
    };

    if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand.bg.surface }}><ActivityIndicator color={primary} /></View>;

    return (
        <View style={{ flex: 1, backgroundColor: colors.brand.bg.surface }}>
            <AppBackTitleBar title={t('memberships', 'Memberships')} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(18), paddingBottom: scale(120) }}>
            <Text variant="body-sm" style={{ color: colors.brand.text.subtitle, marginBottom: scale(16) }}>
                {t('web_handoff_required', 'Paid checkout will use secure web handoff after the one-time session endpoint is implemented.')}
            </Text>
            <View style={{ borderRadius: scale(16), padding: scale(14), backgroundColor: isDark ? '#1B1713' : '#FFFFFF', marginBottom: scale(14) }}>
                <Text variant="body" className="font-body-semi">{t('current_membership', 'Current membership')}</Text>
                <Text variant="body-sm" style={{ color: isDark ? '#A99C8D' : '#7D7266', marginTop: scale(4) }}>
                    {membership?.active ? t('active', 'Active') : t('not_set', 'Not set')}
                </Text>
            </View>
            {plans.map((plan) => (
                <View key={plan.slug || plan.id || plan._id} style={{ borderRadius: scale(16), padding: scale(14), backgroundColor: isDark ? '#1B1713' : '#FFFFFF', marginBottom: scale(12) }}>
                    <Text variant="h3">{plan.name || plan.title || plan.slug}</Text>
                    <Text variant="body-sm" style={{ color: isDark ? '#A99C8D' : '#7D7266', marginVertical: scale(8) }}>
                        {plan.price?.formatted || plan.formatted || plan.description || ''}
                    </Text>
                    <GradientButton title={t('start_free_trial', 'Start free trial')} onPress={() => startTrial(plan)} loading={starting} disabled={starting} widthMode="full" />
                </View>
            ))}
        </ScrollView>
        </View>
    );
}
