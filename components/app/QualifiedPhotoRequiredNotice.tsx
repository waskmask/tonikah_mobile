import { router } from 'expo-router';
import { Camera, TriangleAlert } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { useTheme } from '@/hooks/useTheme';
import { t } from '@/lib/profileDisplay';

export function QualifiedPhotoRequiredNotice() {
    const colors = useColors();
    const { isDark } = useTheme();
    const { isRTL } = useLanguage();
    const warning = '#D78324';
    const backgroundColor = isDark
        ? 'rgba(215, 131, 36, 0.10)'
        : 'rgba(215, 131, 36, 0.08)';

    return (
        <View
            style={[
                styles.card,
                {
                    backgroundColor,
                    borderColor: 'rgba(215, 131, 36, 0.28)',
                },
            ]}
        >
            <View style={[styles.content]}>
                <TriangleAlert
                    color={warning}
                    size={scale(20)}
                    strokeWidth={2.3}
                />
                <View style={styles.copy}>
                    <Text
                        variant="body-sm"
                        className="font-body-bold"
                        style={{
                            color: colors.brand.text.heading,
                            textAlign: isRTL ? 'right' : 'left',
                        }}
                    >
                        {t(
                            'qualified_photo_required_title',
                            'Add an approved profile photo',
                        )}
                    </Text>
                    <Text
                        variant="caption"
                        style={{
                            color: colors.brand.text.subtitle,
                            marginTop: scale(3),
                            textAlign: isRTL ? 'right' : 'left',
                        }}
                    >
                        {t(
                            'qualified_photo_required_message',
                            'You need at least one approved photo of yourself before sending messages.',
                        )}
                    </Text>
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => router.push('/(tabs)/edit-profile' as any)}
                        style={({ pressed }) => [
                            styles.button,
                            { backgroundColor: colors.chrome.primary },
                            pressed && styles.pressed,
                        ]}
                    >
                        <Camera
                            color={colors.chrome.common.inverseText}
                            size={scale(15)}
                            strokeWidth={2.4}
                        />
                        <Text
                            variant="caption"
                            className="font-body-bold"
                            style={{ color: colors.chrome.common.inverseText }}
                        >
                            {t('add_profile_photo', 'Add profile photo')}
                        </Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: scale(8),
        borderWidth: 1,
        marginHorizontal: scale(12),
        marginVertical: scale(8),
        padding: scale(12),
    },
    content: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: scale(9),
    },
    copy: {
        flex: 1,
        minWidth: 0,
    },
    button: {
        alignItems: 'center',
        alignSelf: 'flex-start',
        borderRadius: scale(20),
        flexDirection: 'row',
        gap: scale(6),
        marginTop: scale(9),
        minHeight: scale(36),
        paddingHorizontal: scale(13),
    },
    pressed: {
        opacity: 0.76,
    },
});
