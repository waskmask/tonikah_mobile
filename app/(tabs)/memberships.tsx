import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { membershipService } from '@/lib/membershipService';
import { apiMessage, t } from '@/lib/profileDisplay';
import { useEmailVerificationGuard } from '@/hooks/useEmailVerificationGuard';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';

export default function MembershipsScreen() {
    const { isDark } = useTheme();
    const { requireVerified } = useEmailVerificationGuard();
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
        Alert.alert(t('memberships', 'Memberships'), res.success || res.ok ? t('profile_updated_success', 'Profile updated successfully.') : apiMessage(res.message));
        setStarting(false);
    };

    if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }}><ActivityIndicator color="#F34B6F" /></View>;

    return (
        <ScrollView style={{ flex: 1, backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }} contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(18), paddingBottom: scale(120) }}>
            <Text variant="h2">{t('memberships', 'Memberships')}</Text>
            <Text variant="body-sm" style={{ color: isDark ? '#94A3B8' : '#64748B', marginTop: scale(6), marginBottom: scale(16) }}>
                {t('web_handoff_required', 'Paid checkout will use secure web handoff after the one-time session endpoint is implemented.')}
            </Text>
            <View style={{ borderRadius: scale(16), padding: scale(14), backgroundColor: isDark ? '#111827' : '#FFFFFF', marginBottom: scale(14) }}>
                <Text variant="body" className="font-body-semi">{t('current_membership', 'Current membership')}</Text>
                <Text variant="body-sm" style={{ color: isDark ? '#94A3B8' : '#64748B', marginTop: scale(4) }}>
                    {membership?.active ? t('active', 'Active') : t('not_set', 'Not set')}
                </Text>
            </View>
            {plans.map((plan) => (
                <View key={plan.slug || plan.id || plan._id} style={{ borderRadius: scale(16), padding: scale(14), backgroundColor: isDark ? '#111827' : '#FFFFFF', marginBottom: scale(12) }}>
                    <Text variant="h3">{plan.name || plan.title || plan.slug}</Text>
                    <Text variant="body-sm" style={{ color: isDark ? '#94A3B8' : '#64748B', marginVertical: scale(8) }}>
                        {plan.price?.formatted || plan.formatted || plan.description || ''}
                    </Text>
                    <GradientButton title={t('start_free_trial', 'Start free trial')} onPress={() => startTrial(plan)} loading={starting} disabled={starting} widthMode="full" />
                </View>
            ))}
        </ScrollView>
    );
}
