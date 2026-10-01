import React, { useCallback, useMemo } from 'react';
import { Modal, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import BottomSheet, {
    BottomSheetBackdrop,
    type BottomSheetBackdropProps,
    BottomSheetScrollView,
    useBottomSheetTimingConfigs,
} from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowFatUp, ArrowUDownLeft, BookmarkSimple, SlidersHorizontal } from 'phosphor-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { scale } from '@/hooks/useResponsive';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/hooks/useTheme';
import { t } from '@/lib/profileDisplay';
import { ExploreSharpX } from '@/components/explore/ExploreActionBar';

export function ExploreTourModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const { isDark } = useTheme();
    const { height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const surface = isDark ? '#1D1D1F' : '#FFFFFF';
    const border = isDark ? '#303033' : '#EEEEEE';
    const sheetHeight = Math.min(height * 0.9, scale(520) + insets.bottom);
    const snapPoints = useMemo(() => [sheetHeight], [sheetHeight]);
    const animationConfigs = useBottomSheetTimingConfigs({
        duration: 220,
        easing: Easing.bezier(0.32, 0.72, 0, 1),
    });
    const renderBackdrop = useCallback(
        (props: BottomSheetBackdropProps) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                opacity={0.45}
                pressBehavior="close"
            />
        ),
        [],
    );

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            navigationBarTranslucent
            hardwareAccelerated
            onRequestClose={onClose}
        >
            <GestureHandlerRootView style={styles.fill}>
                <BottomSheet
                    index={0}
                    snapPoints={snapPoints}
                    enableDynamicSizing={false}
                    enablePanDownToClose
                    animateOnMount
                    animationConfigs={animationConfigs}
                    onClose={onClose}
                    backdropComponent={renderBackdrop}
                    backgroundStyle={[styles.sheetBackground, { backgroundColor: surface, borderColor: border }]}
                    handleIndicatorStyle={{ backgroundColor: isDark ? '#6E6E73' : '#A89D91' }}
                >
                    <BottomSheetScrollView
                        contentContainerStyle={[
                            styles.sheetContent,
                            { paddingBottom: insets.bottom + scale(20) },
                        ]}
                        showsVerticalScrollIndicator={false}
                    >
                    <View style={styles.header}>
                        <View>
                            <Text variant="h3" style={styles.title}>{t('tour_title', 'Quick guide')}</Text>
                            <Text variant="body-sm" style={{ color: isDark ? '#B0B0B5' : '#7D7266', marginTop: scale(3) }}>
                                {t('tour_intro', 'Learn what each action does.')}
                            </Text>
                        </View>
                    </View>

                    <TourRow icon={<SlidersHorizontal size={scale(Platform.OS === 'android' ? 22 : 18)} color={isDark ? '#E5E5E7' : '#201B15'} weight="bold" />} title={t('filters', 'Filters')} body={t('show_results', 'Choose age, country, faith and other preferences.')} />
                    <TourRow icon={<ArrowUDownLeft size={scale(24)} color={isDark ? '#F4C95D' : '#B7791F'} weight="bold" />} title={t('undo', 'Undo')} body={t('tour_undo_text', 'Bring back your last skipped profile.')} />
                    <TourRow icon={<ExploreSharpX size={22} color={isDark ? '#FFFFFF' : '#141210'} />} title={t('not_interested', 'Not interested')} body={t('tour_not_interested_text', 'Skip this profile.')} />
                    <TourRow icon={<ArrowFatUp size={scale(28)} color="#FFFFFF" weight="fill" />} title={t('view_profile', 'View profile')} body={t('tour_view_profile_text', 'Open full profile details.')} gradient />
                    <TourRow icon={<BookmarkSimple size={scale(22)} color="#3E9DFF" weight="fill" />} title={t('favorite', 'Save')} body={t('tour_favorite_text', 'Save this profile.')} />

                    <GradientButton title={t('tour_done', 'Done')} onPress={onClose} widthMode="full" size="compact" containerStyle={{ marginTop: scale(12) }} />
                    </BottomSheetScrollView>
                </BottomSheet>
            </GestureHandlerRootView>
        </Modal>
    );
}

function TourRow({ icon, title, body, gradient = false }: { icon: React.ReactNode; title: string; body: string; gradient?: boolean }) {
    const { isDark } = useTheme();
    const colors = useColors();
    return (
        <View style={styles.row}>
            {gradient ? (
                <LinearGradient
                    colors={[colors.brand.gradient.start, colors.brand.gradient.center, colors.brand.gradient.end]}
                    locations={[0, 0.5, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.iconWrap}
                >
                    {icon}
                </LinearGradient>
            ) : (
                <View style={[styles.iconWrap, { backgroundColor: isDark ? '#29292C' : '#F4F4F4' }]}>
                    {icon}
                </View>
            )}
            <View style={{ flex: 1 }}>
                <Text variant="body" className="font-body-semi">{title}</Text>
                <Text variant="body-sm" style={{ color: isDark ? '#B0B0B5' : '#7D7266', marginTop: scale(2), lineHeight: scale(19) }}>
                    {body}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    fill: {
        flex: 1,
    },
    sheetBackground: {
        borderTopLeftRadius: scale(20),
        borderTopRightRadius: scale(20),
        borderWidth: 1,
    },
    sheetContent: {
        paddingHorizontal: scale(18),
        paddingTop: scale(8),
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
