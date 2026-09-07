import React from 'react';
import { Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { CircleAlert, Info } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { toast } from '@/hooks/useToast';
import { scale } from '@/hooks/useResponsive';
import { t } from '@/lib/profileDisplay';

/** "Under review" pill shown next to a field whose text change awaits
    moderation. Tapping explains why the old text is still public.
    Pass interactive={false} inside touchable rows so the pill doesn't
    swallow the row's tap. */
export function UnderReviewPill({ interactive = true }: { interactive?: boolean }) {
    const palette = useColors();
    const reviewColor = palette.brand.accent.error;

    return (
        <Pressable
            disabled={!interactive}
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
            accessibilityRole={interactive ? 'button' : 'text'}
            accessibilityLabel={t('moderation_text_under_review', 'Under review')}
            hitSlop={interactive ? 6 : undefined}
            style={[
                styles.pill,
                {
                    backgroundColor: palette.chrome.common.dangerTint,
                },
            ]}
        >
            <CircleAlert size={scale(12)} color={reviewColor} strokeWidth={2.5} />
            <Text
                variant="caption"
                className="font-body-bold"
                style={[styles.label, { color: reviewColor }]}
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
        height: scale(24),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(4),
        borderRadius: 9999,
        paddingHorizontal: scale(8),
        alignSelf: 'flex-start',
    },
    label: {
        fontSize: scale(11),
        lineHeight: scale(14),
        includeFontPadding: false,
    },
});
