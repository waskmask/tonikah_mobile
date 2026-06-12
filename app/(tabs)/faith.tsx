import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { MultiSelectSheet, MultiSelectOption } from '@/components/ui/MultiSelectSheet';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';
import { apiMessage, displayText, t } from '@/lib/profileDisplay';
import { profileService } from '@/lib/profileService';
import { useAuthStore } from '@/store/authStore';
import { useEmailVerificationGuard } from '@/hooks/useEmailVerificationGuard';

function normalizeMaster(data: any): MultiSelectOption[] {
    const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    return items.map((item: any) => ({
        value: String(item._id || item.value_id),
        label: displayText(item.label || item.name),
    })).filter((item: MultiSelectOption) => item.value && item.label);
}

export default function FaithScreen() {
    const { isDark } = useTheme();
    const { user, refreshUser } = useAuthStore();
    const { requireVerified } = useEmailVerificationGuard();
    const [options, setOptions] = useState<MultiSelectOption[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            setLoading(true);
            const [me, master] = await Promise.all([
                profileService.fetchMe(),
                profileService.fetchMasterdata('faith_in_daily_life'),
            ]);
            setOptions(normalizeMaster(master.data || master));
            const faith = me.user?.profile?.faith_in_daily_life || user?.profile?.faith_in_daily_life || [];
            setSelected(faith.map((item: any) => String(item.value_id || item._id)).filter(Boolean));
            setLoading(false);
        })();
    }, []);

    const selectedLabels = useMemo(
        () => selected.map((id) => options.find((item) => item.value === id)?.label).filter(Boolean) as string[],
        [options, selected]
    );

    const save = async () => {
        if (!requireVerified('save')) return;
        setSaving(true);
        const res = await profileService.saveFaithInDailyLife(selected);
        if (res.success) {
            await refreshUser();
            Alert.alert(t('faith_in_daily_life', 'Faith in daily life'), t('faith_updated', 'Faith updated.'));
        } else {
            Alert.alert(t('error', 'Error'), apiMessage(res.message));
        }
        setSaving(false);
    };

    if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }}><ActivityIndicator color="#F34B6F" /></View>;

    return (
        <ScrollView style={{ flex: 1, backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }} contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(18), paddingBottom: scale(120) }}>
            <Text variant="h2">{t('faith_in_daily_life', 'Faith in daily life')}</Text>
            <Text variant="body-sm" style={{ color: isDark ? '#94A3B8' : '#64748B', marginTop: scale(5), marginBottom: scale(18) }}>
                {t('click_add_faith', 'Add faith in daily life')}
            </Text>
            <Pressable onPress={() => setSheetOpen(true)} style={{ minHeight: scale(120), borderRadius: scale(16), padding: scale(14), backgroundColor: isDark ? '#111827' : '#FFFFFF' }}>
                <Text variant="body">{selectedLabels.length ? selectedLabels.join(', ') : t('select', 'Select')}</Text>
            </Pressable>
            <GradientButton title={t('save', 'Save')} onPress={save} loading={saving} disabled={saving} widthMode="full" containerStyle={{ marginTop: scale(20) }} />
            <MultiSelectSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} onConfirm={setSelected} options={options} selected={selected} title={t('faith_in_daily_life', 'Faith in daily life')} />
        </ScrollView>
    );
}
