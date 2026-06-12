import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Bookmark, ChevronUp, RotateCcw, SlidersHorizontal, X } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { scale } from '@/hooks/useResponsive';
import { useTheme } from '@/hooks/useTheme';
import { t } from '@/lib/profileDisplay';

export function ExploreTourModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const { isDark } = useTheme();
    const surface = isDark ? '#111827' : '#FFFFFF';
    const border = isDark ? '#334155' : '#E2E8F0';

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={[styles.sheet, { backgroundColor: surface, borderColor: border }]}>
                    <View style={styles.header}>
                        <View>
                            <Text variant="h3" style={styles.title}>{t('tour_title', 'Quick guide')}</Text>
                            <Text variant="body-sm" style={{ color: isDark ? '#94A3B8' : '#64748B', marginTop: scale(3) }}>
                                {t('tour_intro', 'Learn what each action does.')}
                            </Text>
                        </View>
                        <Pressable onPress={onClose} style={styles.close}>
                            <X size={scale(20)} color={isDark ? '#E2E8F0' : '#1F2A24'} />
                        </Pressable>
                    </View>

                    <TourRow icon={<SlidersHorizontal size={scale(20)} color="#F34B6F" />} title={t('filters', 'Filters')} body={t('show_results', 'Choose age, country, faith and other preferences.')} />
                    <TourRow icon={<X size={scale(22)} color="#F34B6F" />} title={t('not_interested', 'Not interested')} body={t('tour_not_interested_text', 'Skip this profile.')} />
                    <TourRow icon={<Bookmark size={scale(21)} color="#F34B6F" fill="#F34B6F" />} title={t('favorite', 'Favorite')} body={t('tour_favorite_text', 'Save this profile.')} />
                    <TourRow icon={<ChevronUp size={scale(24)} color="#38A8E8" />} title={t('view_profile', 'View profile')} body={t('tour_view_profile_text', 'Open full profile details.')} />
                    <TourRow icon={<RotateCcw size={scale(20)} color="#7A8480" />} title={t('undo', 'Undo')} body={t('tour_undo_text', 'Bring back your last skipped profile.')} />

                    <GradientButton title={t('tour_done', 'Done')} onPress={onClose} widthMode="full" containerStyle={{ marginTop: scale(12) }} />
                </View>
            </View>
        </Modal>
    );
}

function TourRow({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
    const { isDark } = useTheme();
    return (
        <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: isDark ? '#1E293B' : '#FDF0F3' }]}>
                {icon}
            </View>
            <View style={{ flex: 1 }}>
                <Text variant="body" className="font-body-semi">{title}</Text>
                <Text variant="body-sm" style={{ color: isDark ? '#94A3B8' : '#64748B', marginTop: scale(2), lineHeight: scale(19) }}>
                    {body}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(15,23,42,0.45)',
    },
    sheet: {
        borderTopLeftRadius: scale(20),
        borderTopRightRadius: scale(20),
        borderWidth: 1,
        paddingHorizontal: scale(18),
        paddingTop: scale(18),
        paddingBottom: scale(28),
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: scale(12),
        marginBottom: scale(14),
    },
    title: {
        fontSize: scale(22),
        lineHeight: scale(27),
    },
    close: {
        width: scale(38),
        height: scale(38),
        borderRadius: scale(19),
        alignItems: 'center',
        justifyContent: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: scale(12),
        paddingVertical: scale(9),
    },
    iconWrap: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(20),
        alignItems: 'center',
        justifyContent: 'center',
    },
});
