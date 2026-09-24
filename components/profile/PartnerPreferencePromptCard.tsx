import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Plus } from 'lucide-react-native';
import { DashedRoundedBorder } from '@/components/ui/DashedRoundedBorder';
import { SmallDarkOutlinedButton } from '@/components/ui/SmallDarkOutlinedButton';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';

type Props = {
    title: string;
    actionLabel: string;
    onPress: () => void;
    style?: StyleProp<ViewStyle>;
};

export function PartnerPreferencePromptCard({ title, actionLabel, onPress, style }: Props) {
    const palette = useColors();

    return (
        <View
            style={[
                styles.card,
                { backgroundColor: palette.chrome.common.subtleSurface },
                style,
            ]}
        >
            <DashedRoundedBorder color={palette.chrome.primary} />
            <Text
                variant="body-sm"
                className="font-body-medium"
                numberOfLines={2}
                style={[styles.title, { color: palette.chrome.common.textStrong }]}
            >
                {title}
            </Text>
            <SmallDarkOutlinedButton
                label={actionLabel}
                onPress={onPress}
                accessibilityLabel={actionLabel}
                icon={Plus}
                labelWeight="500"
                foregroundColor="#FFFFFF"
                backgroundColor="#201B15"
                borderColor="#201B15"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        position: 'relative',
        minHeight: scale(56),
        marginHorizontal: scale(14),
        marginTop: scale(14),
        marginBottom: scale(24),
        borderRadius: scale(8),
        paddingHorizontal: scale(16),
        paddingVertical: scale(12.5),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: scale(12),
    },
    title: {
        flex: 1,
        minWidth: 0,
        fontSize: scale(14),
        lineHeight: scale(19),
        fontWeight: '500',
    },
});
