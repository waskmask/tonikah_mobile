import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { GradientButton } from '@/components/ui/GradientButton';
import { MultiSelectSheet, MultiSelectOption } from '@/components/ui/MultiSelectSheet';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';
import { apiMessage, displayText, t } from '@/lib/profileDisplay';
import { profileService } from '@/lib/profileService';
import { useAuthStore } from '@/store/authStore';
import { useEmailVerificationGuard } from '@/hooks/useEmailVerificationGuard';
import { useToast } from '@/hooks/useToast';

function normalizeMaster(data: any): MultiSelectOption[] {
    const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    return items.map((item: any) => ({
        value: String(item._id || item.value_id),
        label: displayText(item.label || item.name),
    })).filter((item: MultiSelectOption) => item.value && item.label);
}

export default function MyHobbiesScreen() {
    const { isDark } = useTheme();
    const colors = useColors();
    const primary = colors.chrome.primary;
    const { user, refreshUser } = useAuthStore();
    const { requireVerified } = useEmailVerificationGuard();
    const toast = useToast();
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
                profileService.fetchMasterdata('hobbies'),
            ]);
            const masterOptions = normalizeMaster(master.data || master);
            setOptions(masterOptions);
            const profileHobbies = me.user?.profile?.hobbies || user?.profile?.hobbies || [];
            setSelected(profileHobbies.map((item: any) => String(item.value_id || item._id)).filter(Boolean));
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
        const res = await profileService.saveHobbies(selected);
        if (res.success) {
            await refreshUser();
            toast.show(t('profile_updated_success', 'Profile updated successfully.'), 'success', 3000);
        } else {
            Alert.alert(t('error', 'Error'), apiMessage(res.message));
        }
        setSaving(false);
    };

    if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand.bg.surface }}><ActivityIndicator color={primary} /></View>;

    return (
        <View style={{ flex: 1, backgroundColor: colors.brand.bg.surface }}>
            <AppBackTitleBar title={t('hobbies', 'Hobbies')} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(18), paddingBottom: scale(120) }}>
            <Text variant="body-sm" style={{ color: colors.brand.text.subtitle, marginBottom: scale(18) }}>
                {t('click_add_hobbies', 'Click here to add Hobbies')}
            </Text>
            <Pressable onPress={() => setSheetOpen(true)} style={{ minHeight: scale(120), borderRadius: scale(16), padding: scale(14), backgroundColor: isDark ? '#111827' : '#FFFFFF' }}>
                <Text variant="body">{selectedLabels.length ? selectedLabels.join(', ') : t('select', 'Select')}</Text>
            </Pressable>
            <GradientButton title={t('save', 'Save')} onPress={save} loading={saving} disabled={saving} widthMode="full" containerStyle={{ marginTop: scale(20) }} />
            <MultiSelectSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} onConfirm={setSelected} options={options} selected={selected} title={t('hobbies', 'Hobbies')} />
        </ScrollView>
        </View>
    );
}
