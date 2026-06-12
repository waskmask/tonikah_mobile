import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { chatService } from '@/lib/chatService';
import { apiMessage, t } from '@/lib/profileDisplay';
import { useAuthStore } from '@/store/authStore';
import { useEmailVerificationGuard } from '@/hooks/useEmailVerificationGuard';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { Typography } from '@/constants/typography';

export default function ConversationScreen() {
    const { id, recipientId, name } = useLocalSearchParams<{ id: string; recipientId?: string; name?: string }>();
    const { user } = useAuthStore();
    const { requireVerified } = useEmailVerificationGuard();
    const { isDark } = useTheme();
    const { currentLanguage } = useLanguage();
    const inputFontFamily = currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.regular;
    const [items, setItems] = useState<any[]>([]);
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(id !== 'new');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        (async () => {
            if (!id || id === 'new') return;
            setLoading(true);
            const res = await chatService.messages(id);
            if (res.success) setItems(res.items || []);
            else Alert.alert(t('error', 'Error'), apiMessage(res.message));
            setLoading(false);
        })();
    }, [id]);

    const send = async () => {
        if (!requireVerified('chat')) return;
        if (!content.trim()) {
            Alert.alert(t('message_empty', 'Please enter a message before sending.'));
            return;
        }
        setSending(true);
        const res = await chatService.send({
            conversationId: id !== 'new' ? id : undefined,
            recipientId: id === 'new' ? recipientId : undefined,
            content: content.trim(),
        });
        if (res.success) {
            setContent('');
            if (res.message) setItems((current) => [...current, res.message]);
            if (id !== 'new') {
                const refreshed = await chatService.messages(id);
                if (refreshed.success) setItems(refreshed.items || []);
            }
        } else {
            Alert.alert(t('error', 'Error'), apiMessage(res.message));
        }
        setSending(false);
    };

    if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }}><ActivityIndicator color="#F34B6F" /></View>;

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }}>
            <View style={{ padding: scale(18), paddingBottom: scale(8) }}>
                <Text variant="h2">{name || t('messages', 'Messages')}</Text>
            </View>
            <FlatList
                data={items}
                keyExtractor={(item, index) => String(item.id || item._id || index)}
                contentContainerStyle={{ padding: scale(18), paddingTop: 0, flexGrow: 1 }}
                renderItem={({ item }) => {
                    const mine = String(item.sender || item.senderId) === String(user?._id);
                    return (
                        <View style={[styles.bubble, mine ? styles.mine : styles.theirs, { backgroundColor: mine ? '#F34B6F' : isDark ? '#111827' : '#FFFFFF' }]}>
                            <Text variant="body" style={{ color: mine ? '#FFFFFF' : undefined }}>{item.content || item.text || ''}</Text>
                        </View>
                    );
                }}
            />
            <View style={[styles.composer, { backgroundColor: isDark ? '#111827' : '#FFFFFF' }]}>
                <TextInput
                    value={content}
                    onChangeText={setContent}
                    placeholder={t('intro_message', 'Write a short introduction message...')}
                    placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
                    style={{ flex: 1, color: isDark ? '#E2E8F0' : '#0A0D14', fontFamily: inputFontFamily }}
                    multiline
                />
                <Pressable onPress={send} disabled={sending} style={styles.send}>
                    {sending ? <ActivityIndicator color="#FFFFFF" /> : <Send size={scale(18)} color="#FFFFFF" />}
                </Pressable>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    bubble: { maxWidth: '82%', borderRadius: scale(16), padding: scale(12), marginBottom: scale(8) },
    mine: { alignSelf: 'flex-end', borderBottomRightRadius: scale(4) },
    theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: scale(4) },
    composer: { flexDirection: 'row', alignItems: 'center', gap: scale(10), padding: scale(12), borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#E2E8F0' },
    send: { width: scale(42), height: scale(42), borderRadius: scale(21), backgroundColor: '#F34B6F', alignItems: 'center', justifyContent: 'center' },
});
