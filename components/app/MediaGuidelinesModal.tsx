import React from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    useWindowDimensions,
    View,
} from 'react-native';
import { Image } from 'expo-image';
import {
    CheckCircle2,
    EyeOff,
    ShieldAlert,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { t } from '@/lib/profileDisplay';

const SAMPLE_IMAGES: Record<'male' | 'female', [number, number]> = {
    male: [
        require('../../assets/images/g-sample/male-1.webp'),
        require('../../assets/images/g-sample/male-2.webp'),
    ],
    female: [
        require('../../assets/images/g-sample/female-1.webp'),
        require('../../assets/images/g-sample/female-2.webp'),
    ],
};

const REJECTED_REASON_KEYS = [
    'image_moderation_nsfw',
    'image_moderation_no_human',
    'image_moderation_hateful_text',
    'image_moderation_contact_info',
    'image_moderation_presentation_mismatch',
] as const;

type Props = {
    visible: boolean;
    gender: 'male' | 'female';
    canUsePrivateGallery?: boolean;
    onAcknowledge: () => void;
};

export function MediaGuidelinesModal({
    visible,
    gender,
    canUsePrivateGallery = gender === 'female',
    onAcknowledge,
}: Props) {
    const colors = useColors();
    const { isRTL } = useLanguage();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const tablet = width >= 640;
    const rowDirection = 'row';

    return (
        <Modal
            visible={visible}
            transparent
            animationType={tablet ? 'fade' : 'slide'}
            statusBarTranslucent
            navigationBarTranslucent
            hardwareAccelerated
            onRequestClose={() => undefined}
        >
            <View style={[styles.overlay, tablet && styles.overlayCentered]}>
                <View
                    style={[
                        styles.sheet,
                        tablet ? styles.dialog : styles.mobileSheet,
                        {
                            backgroundColor: colors.chrome.common.card,
                            borderColor: colors.brand.bg.border,
                            paddingBottom: Math.max(insets.bottom, scale(16)),
                        },
                    ]}
                >
                    <ScrollView
                        contentContainerStyle={styles.content}
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                    >
                        <View style={[styles.headingRow, { flexDirection: rowDirection }]}>
                            <View style={[styles.headingIcon, { backgroundColor: colors.chrome.common.primaryTint }]}>
                                <ShieldAlert size={scale(21)} color={colors.chrome.primary} />
                            </View>
                            <View style={styles.headingCopy}>
                                <Text
                                    variant="body"
                                    className="font-body-bold"
                                    style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}
                                >
                                    {t('media_guidelines_title', 'Choose clear images')}
                                </Text>
                                <Text
                                    variant="body-sm"
                                    style={[
                                        styles.intro,
                                        {
                                            color: colors.brand.text.subtitle,
                                            textAlign: isRTL ? 'right' : 'left',
                                        },
                                    ]}
                                >
                                    {t(
                                        'media_guidelines_intro',
                                        'Upload clear images of yourself. At least one image is required to use the app. Images are checked before other members can see them.',
                                    )}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.section}>
                            <View style={[styles.sectionTitleRow, { flexDirection: rowDirection }]}>
                                <CheckCircle2 size={scale(18)} color={colors.brand.accent.success} />
                                <Text variant="body-sm" className="font-body-bold">
                                    {t('media_guidelines_good_title', 'Good profile photos')}
                                </Text>
                            </View>
                            <View style={[styles.samples, { flexDirection: rowDirection }]}>
                                {SAMPLE_IMAGES[gender].map((source, index) => (
                                    <Image
                                        key={index}
                                        source={source}
                                        style={[styles.sample, { backgroundColor: colors.brand.bg.surface }]}
                                        contentFit="cover"
                                        accessibilityLabel={t(
                                            'media_guidelines_sample_alt',
                                            `Example profile photo ${index + 1}`,
                                            { number: index + 1 },
                                        )}
                                    />
                                ))}
                            </View>
                        </View>

                        <View style={[styles.section, styles.divided, { borderTopColor: colors.brand.bg.border }]}>
                            <View style={[styles.sectionTitleRow, { flexDirection: rowDirection }]}>
                                <ShieldAlert size={scale(18)} color={colors.brand.accent.warning} />
                                <Text variant="body-sm" className="font-body-bold">
                                    {t('media_guidelines_bad_title', 'Photos we cannot approve')}
                                </Text>
                            </View>
                            <View style={styles.reasonList}>
                                {REJECTED_REASON_KEYS.map((key) => (
                                    <View key={key} style={[styles.reasonRow, { flexDirection: rowDirection }]}>
                                        <View style={[styles.bullet, { backgroundColor: colors.brand.accent.warning }]} />
                                        <Text
                                            variant="caption"
                                            style={[
                                                styles.reasonText,
                                                {
                                                    color: colors.brand.text.subtitle,
                                                    textAlign: isRTL ? 'right' : 'left',
                                                },
                                            ]}
                                        >
                                            {t(key, key)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {canUsePrivateGallery ? (
                            <View
                                style={[
                                    styles.privateNotice,
                                    {
                                        flexDirection: rowDirection,
                                        borderColor: colors.brand.bg.border,
                                        backgroundColor: colors.brand.bg.surface,
                                    },
                                ]}
                            >
                                <EyeOff size={scale(20)} color={colors.chrome.primary} />
                                <View style={styles.privateCopy}>
                                    <Text variant="caption" className="font-body-bold">
                                        {t('media_guidelines_private_title', 'Keep your gallery private')}
                                    </Text>
                                    <Text
                                        variant="caption"
                                        style={[
                                            styles.privateMessage,
                                            {
                                                color: colors.brand.text.subtitle,
                                                textAlign: isRTL ? 'right' : 'left',
                                            },
                                        ]}
                                    >
                                        {t(
                                            'media_guidelines_private_message',
                                            'You can hide your photos and reveal them only after you start a conversation with someone.',
                                        )}
                                    </Text>
                                </View>
                            </View>
                        ) : null}

                        <GradientButton
                            title={t('media_guidelines_understand', 'I understand')}
                            onPress={onAcknowledge}
                            widthMode="full"
                            height={44}
                            textSize={14}
                            containerStyle={styles.button}
                        />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(14, 12, 9, 0.58)',
    },
    overlayCentered: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: scale(20),
    },
    sheet: {
        width: '100%',
        maxHeight: '94%',
        borderWidth: 1,
    },
    mobileSheet: {
        borderTopLeftRadius: scale(16),
        borderTopRightRadius: scale(16),
    },
    dialog: {
        maxWidth: scale(560),
        borderRadius: scale(12),
    },
    content: {
        paddingHorizontal: scale(18),
        paddingTop: scale(20),
    },
    headingRow: {
        alignItems: 'flex-start',
        gap: scale(11),
    },
    headingIcon: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(20),
        alignItems: 'center',
        justifyContent: 'center',
    },
    headingCopy: {
        flex: 1,
        minWidth: 0,
    },
    title: {
        fontSize: scale(18),
        lineHeight: scale(24),
    },
    intro: {
        marginTop: scale(5),
        fontSize: scale(13),
        lineHeight: scale(20),
    },
    section: {
        marginTop: scale(18),
    },
    divided: {
        borderTopWidth: 1,
        paddingTop: scale(17),
    },
    sectionTitleRow: {
        alignItems: 'center',
        gap: scale(7),
    },
    samples: {
        marginTop: scale(11),
        gap: scale(11),
    },
    sample: {
        flex: 1,
        aspectRatio: 3 / 4,
        borderRadius: scale(8),
    },
    reasonList: {
        marginTop: scale(10),
        gap: scale(7),
    },
    reasonRow: {
        alignItems: 'flex-start',
        gap: scale(8),
    },
    bullet: {
        width: scale(6),
        height: scale(6),
        borderRadius: scale(3),
        marginTop: scale(7),
    },
    reasonText: {
        flex: 1,
        fontSize: scale(12),
        lineHeight: scale(18),
    },
    privateNotice: {
        marginTop: scale(18),
        borderWidth: 1,
        borderRadius: scale(8),
        padding: scale(12),
        alignItems: 'flex-start',
        gap: scale(10),
    },
    privateCopy: {
        flex: 1,
    },
    privateMessage: {
        marginTop: scale(3),
        lineHeight: scale(18),
    },
    button: {
        marginTop: scale(18),
    },
});
