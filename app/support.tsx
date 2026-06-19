import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { supportService } from '@/lib/supportService';
import { apiMessage, t } from '@/lib/profileDisplay';
import { useAuthStore } from '@/store/authStore';
import { useEmailVerificationGuard } from '@/hooks/useEmailVerificationGuard';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';
import { Typography } from '@/constants/typography';
import { useToast } from '@/hooks/useToast';

export default function SupportScreen() {
    const { isDark } = useTheme();
    const { currentLanguage } = useLanguage();
    const { user } = useAuthStore();
    const { requireVerified } = useEmailVerificationGuard();
    const toast = useToast();
    const [type, setType] = useState('bug');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (!requireVerified('report')) return;
        setSaving(true);
        const res = await supportService.createTicket({
            name: user?.profile?.profileName || user?.username || '',
            email: user?.email || '',
            language: currentLanguage,
            type,
            subject,
            message,
            page: 'rn-app',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        if (res.success) {
            setSubject('');
            setMessage('');
            toast.show(t('ticket_created', 'Ticket created.'), 'success', 3000);
        } else {
            Alert.alert(t('error', 'Error'), apiMessage(res.message));
        }
        setSaving(false);
    };

    return (
        <ScrollView style={{ flex: 1, backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }} contentContainerStyle={{ padding: scale(18), paddingBottom: scale(120) }}>
            <Text variant="h2">{t('report_issue', 'Report issue')}</Text>
            <Field label={t('support_type', 'Support type')} value={type} onChangeText={setType} isDark={isDark} />
            <Field label={t('subject', 'Subject')} value={subject} onChangeText={setSubject} isDark={isDark} />
            <Field label={t('message', 'Message')} value={message} onChangeText={setMessage} multiline isDark={isDark} />
            <GradientButton title={t('send_message', 'Send Message')} onPress={submit} loading={saving} disabled={saving || subject.trim().length < 3 || message.trim().length < 10} widthMode="full" containerStyle={{ marginTop: scale(20) }} />
        </ScrollView>
    );
}

function Field({ label, isDark, ...props }: any) {
    const { currentLanguage } = useLanguage();
    const inputFontFamily = currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.regular;

    return (
        <View style={{ marginTop: scale(16) }}>
            <Text variant="body-sm" style={{ marginBottom: scale(6) }}>{label}</Text>
            <TextInput
                {...props}
                placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
                style={[styles.input, props.multiline && styles.textArea, { color: isDark ? '#E2E8F0' : '#0A0D14', backgroundColor: isDark ? '#111827' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0', fontFamily: inputFontFamily }]}
                textAlignVertical={props.multiline ? 'top' : 'center'}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    input: { minHeight: scale(50), borderWidth: 1, borderRadius: scale(12), paddingHorizontal: scale(14), fontSize: scale(14) },
    textArea: { minHeight: scale(180), paddingTop: scale(12) },
});
