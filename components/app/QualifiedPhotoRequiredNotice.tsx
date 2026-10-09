import { router } from 'expo-router';
import { Camera } from '@/components/ui/icons/PhosphorCompat';
import { TouchableOpacity, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { t } from '@/lib/profileDisplay';

export function QualifiedPhotoRequiredNotice() {
    const colors = useColors();
    const { isRTL } = useLanguage();
    const warning = colors.chrome.toast.warning;

    return (
        <View
            style={[
                styles.card,
                {
                    backgroundColor: warning.bg,
                    borderColor: warning.border,
                },
            ]}
        >
            <View style={[styles.content]}>
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
                            color: warning.text,
                            marginTop: scale(3),
                            textAlign: isRTL ? 'right' : 'left',
                        }}
                    >
                        {t(
                            'qualified_photo_required_message',
                            'You need at least one approved photo of yourself before sending messages.',
                        )}
                    </Text>
                    <TouchableOpacity
                        accessibilityRole="button"
                        activeOpacity={0.76}
                        onPress={() => router.push('/edit-profile' as any)}
                        style={[
                            styles.button,
                            { backgroundColor: colors.chrome.primary },
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
                    </TouchableOpacity>
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
});
