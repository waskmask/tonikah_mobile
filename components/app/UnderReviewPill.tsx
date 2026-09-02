import React from 'react';
import { Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Clock3, Info } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { toast } from '@/hooks/useToast';
import { scale } from '@/hooks/useResponsive';
import { t } from '@/lib/profileDisplay';

/** "Under review" pill shown next to a field whose text change awaits
    moderation. Tapping explains why the old text is still public. */
export function UnderReviewPill() {
    const palette = useColors();
    const warning = palette.chrome.toast.warning;

    return (
        <Pressable
            onPress={() =>
                toast.show(
                    t(
                        'moderation_text_under_review_hint',
                        'This update is waiting for review. Other users will see your previous approved text until it is approved.',
                    ),
                    'info',
                    4000,
                )
            }
            accessibilityRole="button"
            accessibilityLabel={t('moderation_text_under_review', 'Under review')}
            hitSlop={6}
            style={[
                styles.pill,
                {
                    borderColor: warning.border,
                    backgroundColor: warning.bg,
                },
            ]}
        >
            <Clock3 size={scale(11)} color={warning.icon} />
            <Text
                variant="caption"
                className="font-body-semi"
                style={[styles.label, { color: warning.text }]}
            >
                {t('moderation_text_under_review', 'Under review')}
            </Text>
        </Pressable>
    );
}

/** Subtle inline info icon next to owner-visible pending text (headline/bio).
    Tapping explains that others still see the previous approved text —
    mirrors ModerationUnderReviewIcon in the Next.js web app. */
export function UnderReviewInfoIcon({ style }: { style?: StyleProp<ViewStyle> }) {
    const palette = useColors();

    return (
        <Pressable
            onPress={() =>
                toast.show(
                    t(
                        'moderation_text_under_review_hint',
                        'This update is waiting for review. Other users will see your previous approved text until it is approved.',
                    ),
                    'info',
                    4000,
                )
            }
            accessibilityRole="button"
            accessibilityLabel={t('moderation_text_under_review', 'Under review')}
            hitSlop={8}
            style={[styles.infoIcon, style]}
        >
            <Info size={scale(15)} color={palette.brand.text.muted} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    infoIcon: {
        padding: scale(2),
        alignSelf: 'flex-start',
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(4),
        borderWidth: 1,
        borderRadius: 9999,
        paddingHorizontal: scale(8),
        paddingVertical: scale(2.5),
        alignSelf: 'flex-start',
    },
    label: {
        fontSize: scale(10.5),
    },
});
