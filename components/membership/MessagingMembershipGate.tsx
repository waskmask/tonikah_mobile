import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { CreditCard, X } from 'lucide-react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';
import { t } from '@/lib/profileDisplay';
import type { TrialOffer } from '@/lib/messagingAccess';

type Props = { visible: boolean; trialOffer?: TrialOffer | null; onClose: () => void };

export function MessagingMembershipGate({ visible, trialOffer, onClose }: Props) {
    const colors = useColors();
    const trialAvailable = trialOffer?.available === true;
    const title = trialAvailable
        ? t('chat:membership_trial_title', 'Start your free trial')
        : t('chat:membership_required_title', 'Membership required');
    const description = trialAvailable
        ? t('chat:membership_trial_desc', 'Activate your {{days}}-day trial to open conversations.', { days: trialOffer.durationDays })
        : t('chat:membership_required_desc', 'Activate membership to open and use conversations.');

    const continueToMembership = () => {
        onClose();
        router.push({ pathname: '/(tabs)/memberships', params: { returnTo: '/(tabs)/messages', trial: trialOffer?.planSlug || '' } } as any);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <View style={[styles.card, { backgroundColor: colors.chrome.common.card, borderColor: colors.brand.bg.border }]}> 
                    <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
                        <X size={scale(20)} color={colors.chrome.header.icon} />
                    </Pressable>
                    <View style={[styles.icon, { backgroundColor: colors.chrome.common.primaryTint }]}> 
                        <CreditCard size={scale(24)} color={colors.chrome.primary} />
                    </View>
                    <Text variant="h3" className="font-body-bold" style={{ color: colors.chrome.common.textStrong, textAlign: 'center' }}>{title}</Text>
                    <Text variant="body-sm" style={{ color: colors.chrome.common.textSubtle, textAlign: 'center' }}>{description}</Text>
                    <GradientButton title={trialAvailable ? t('chat:start_free_trial', 'View free trial') : t('chat:view_memberships', 'View memberships')} onPress={continueToMembership} />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.52)', justifyContent: 'center', padding: scale(22) },
    card: { width: '100%', maxWidth: scale(420), alignSelf: 'center', borderRadius: scale(8), borderWidth: StyleSheet.hairlineWidth, padding: scale(22), gap: scale(14) },
    close: { position: 'absolute', top: scale(14), right: scale(14), zIndex: 2 },
    icon: { width: scale(50), height: scale(50), borderRadius: scale(25), alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
});
