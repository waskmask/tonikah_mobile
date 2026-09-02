import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Pressable,
    Modal,
    FlatList,
    StyleSheet,
    PixelRatio,
} from 'react-native';
import BottomSheet, {
    BottomSheetBackdrop,
    BottomSheetBackdropProps,
    BottomSheetView,
} from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    Extrapolation,
    SharedValue,
    interpolate,
    interpolateColor,
    runOnJS,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
} from 'react-native-reanimated';
import { Text } from './Text';
import { GradientButton } from './GradientButton';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { useHaptics } from '@/hooks/useHaptics';
import { scale } from '@/hooks/useResponsive';
import { X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '@/constants/typography';
import { t } from '@/lib/profileDisplay';

interface DateWheelSheetProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (date: Date) => void;
    value?: Date | null;
    minDate: Date;
    maxDate: Date;
    title: string;
}

interface WheelItem {
    value: number;
    label: string;
}

// Pixel-aligned row height: a fractional dp height gets rounded per-row by
// the native layout pass, so real row positions drift away from
// index * ITEM_HEIGHT the further down the list you scroll — items then
// settle visibly below the highlight band
const ITEM_HEIGHT = PixelRatio.roundToNearestPixel(scale(40));
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
// Rows above/below the center row, so first/last items can reach the middle
const EDGE_PADDING = ITEM_HEIGHT * Math.floor(VISIBLE_ROWS / 2);

const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

const clampToRange = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

interface WheelProps {
    data: WheelItem[];
    selected: number;
    onChange: (value: number) => void;
    fontFamily: string;
    activeColor: string;
    idleColor: string;
}

interface WheelRowProps {
    label: string;
    index: number;
    scrollY: SharedValue<number>;
    fontFamily: string;
    activeColor: string;
    idleColor: string;
}

// Memoized row whose active style is driven by the scroll position on the UI
// thread — the FlatList never re-renders while the wheel spins
const WheelRow = React.memo(function WheelRow({
    label,
    index,
    scrollY,
    fontFamily,
    activeColor,
    idleColor,
}: WheelRowProps) {
    const animatedStyle = useAnimatedStyle(() => {
        // 1 when this row sits in the highlight band, fading to 0 a row away
        const active = interpolate(
            Math.abs(scrollY.value - index * ITEM_HEIGHT) / ITEM_HEIGHT,
            [0, 1],
            [1, 0],
            Extrapolation.CLAMP,
        );
        return {
            color: interpolateColor(active, [0, 1], [idleColor, activeColor]),
            opacity: 0.55 + 0.45 * active,
            // Scale instead of fontSize: no text re-layout per frame
            transform: [{ scale: 1 + 0.14 * active }],
        };
    });

    return (
        <View style={styles.wheelItem}>
            <Animated.Text style={[{ fontFamily, fontSize: scale(14) }, animatedStyle]}>
                {label}
            </Animated.Text>
        </View>
    );
});

function Wheel({ data, selected, onChange, fontFamily, activeColor, idleColor }: WheelProps) {
    const listRef = useRef<FlatList<WheelItem>>(null);
    const userScrolling = useRef(false);
    const { lightImpact } = useHaptics();

    const selectedIndex = Math.max(0, data.findIndex((d) => d.value === selected));

    const scrollY = useSharedValue(selectedIndex * ITEM_HEIGHT);
    const lastTickIndex = useSharedValue(selectedIndex);

    // Re-center when the selection is changed programmatically (e.g. day
    // clamped after a month switch) or the option list itself changes length
    useEffect(() => {
        if (userScrolling.current) return;
        listRef.current?.scrollToOffset({ offset: selectedIndex * ITEM_HEIGHT, animated: false });
        scrollY.value = selectedIndex * ITEM_HEIGHT;
    }, [selectedIndex, data.length]);

    const settle = (y: number) => {
        userScrolling.current = false;
        const idx = clampToRange(Math.round(y / ITEM_HEIGHT), 0, data.length - 1);
        // Snap correction: even with pixel-aligned rows the platform can
        // settle a hair off the interval — always land exactly on the row
        listRef.current?.scrollToOffset({ offset: idx * ITEM_HEIGHT, animated: true });
        const value = data[idx].value;
        if (value !== selected) onChange(value);
    };

    const maxIndex = data.length - 1;
    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (e) => {
            const y = e.contentOffset.y;
            scrollY.value = y;
            // Haptic tick each time a new row crosses the band
            const idx = Math.min(Math.max(Math.round(y / ITEM_HEIGHT), 0), maxIndex);
            if (idx !== lastTickIndex.value) {
                lastTickIndex.value = idx;
                runOnJS(lightImpact)();
            }
        },
        onMomentumEnd: (e) => {
            runOnJS(settle)(e.contentOffset.y);
        },
    });

    const renderItem = useCallback(
        ({ item, index }: { item: WheelItem; index: number }) => (
            <WheelRow
                label={item.label}
                index={index}
                scrollY={scrollY}
                fontFamily={fontFamily}
                activeColor={activeColor}
                idleColor={idleColor}
            />
        ),
        [scrollY, fontFamily, activeColor, idleColor],
    );

    return (
        <Animated.FlatList
            ref={listRef as never}
            data={data}
            style={{ flex: 1, height: WHEEL_HEIGHT }}
            keyExtractor={(item: WheelItem) => String(item.value)}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_HEIGHT}
            decelerationRate="fast"
            initialScrollIndex={selectedIndex}
            getItemLayout={(_: unknown, index: number) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
            contentContainerStyle={{ paddingVertical: EDGE_PADDING }}
            onScrollBeginDrag={() => { userScrolling.current = true; }}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            windowSize={5}
            maxToRenderPerBatch={12}
            renderItem={renderItem}
        />
    );
}

export function DateWheelSheet({
    visible,
    onClose,
    onConfirm,
    value,
    minDate,
    maxDate,
    title,
}: DateWheelSheetProps) {
    const palette = useColors();
    const { currentLanguage, isRTL } = useLanguage();
    const insets = useSafeAreaInsets();
    const fontFamily = currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.medium;

    const initial = value ?? maxDate;
    const [year, setYear] = useState(initial.getFullYear());
    const [month, setMonth] = useState(initial.getMonth());
    const [day, setDay] = useState(initial.getDate());

    // Re-seed the wheels every time the sheet opens; a dismissed sheet keeps
    // stale state otherwise
    useEffect(() => {
        if (!visible) return;
        const d = value ?? maxDate;
        setYear(d.getFullYear());
        setMonth(d.getMonth());
        setDay(d.getDate());
    }, [visible, value, maxDate]);

    const monthNames = useMemo(() => {
        const fmt = new Intl.DateTimeFormat(currentLanguage, { month: 'long' });
        return Array.from({ length: 12 }, (_, m) => fmt.format(new Date(2000, m, 1)));
    }, [currentLanguage]);

    const years = useMemo(() => {
        const list: WheelItem[] = [];
        for (let y = minDate.getFullYear(); y <= maxDate.getFullYear(); y++) {
            list.push({ value: y, label: String(y) });
        }
        return list;
    }, [minDate, maxDate]);

    // Months narrow at the boundary years so a date outside min/max can never
    // be assembled; days narrow the same way below
    const months = useMemo(() => {
        const from = year === minDate.getFullYear() ? minDate.getMonth() : 0;
        const to = year === maxDate.getFullYear() ? maxDate.getMonth() : 11;
        const list: WheelItem[] = [];
        for (let m = from; m <= to; m++) list.push({ value: m, label: monthNames[m] });
        return list;
    }, [year, minDate, maxDate, monthNames]);

    const days = useMemo(() => {
        let from = 1;
        let to = daysInMonth(year, month);
        if (year === minDate.getFullYear() && month === minDate.getMonth()) from = minDate.getDate();
        if (year === maxDate.getFullYear() && month === maxDate.getMonth()) to = Math.min(to, maxDate.getDate());
        const list: WheelItem[] = [];
        for (let d = from; d <= to; d++) list.push({ value: d, label: String(d).padStart(2, '0') });
        return list;
    }, [year, month, minDate, maxDate]);

    // Clamp selections that fell outside the narrowed lists
    useEffect(() => {
        const m = clampToRange(month, months[0].value, months[months.length - 1].value);
        if (m !== month) setMonth(m);
    }, [months, month]);
    useEffect(() => {
        const d = clampToRange(day, days[0].value, days[days.length - 1].value);
        if (d !== day) setDay(d);
    }, [days, day]);

    const renderBackdrop = useCallback(
        (props: BottomSheetBackdropProps) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                pressBehavior="close"
                opacity={0.4}
            />
        ),
        [],
    );

    const handleConfirm = () => {
        onConfirm(new Date(year, month, day));
        onClose();
    };

    const sheetHeight = scale(48) + WHEEL_HEIGHT + scale(88) + insets.bottom;
    const card = palette.chrome.common.card;

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
            <GestureHandlerRootView style={{ flex: 1 }}>
                <BottomSheet
                    snapPoints={[sheetHeight]}
                    index={0}
                    enablePanDownToClose
                    enableDynamicSizing={false}
                    // Wheels own the vertical drag; only the handle closes the sheet
                    enableContentPanningGesture={false}
                    onClose={onClose}
                    backdropComponent={renderBackdrop}
                    backgroundStyle={{ backgroundColor: card }}
                    handleIndicatorStyle={{ backgroundColor: palette.brand.text.muted }}
                >
                    <BottomSheetView style={{ flex: 1 }}>
                        <View style={styles.header}>
                            <Text variant="body-sm" className="font-body-bold" style={styles.sheetTitle}>
                                {title}
                            </Text>
                            <Pressable onPress={onClose} hitSlop={12}>
                                <X size={scale(20)} color={palette.brand.text.subtitle} />
                            </Pressable>
                        </View>

                        <View style={styles.wheelArea}>
                            {/* Center highlight band */}
                            <View
                                pointerEvents="none"
                                style={[
                                    styles.highlightBand,
                                    { backgroundColor: palette.chrome.common.primaryTint },
                                ]}
                            />
                            <View style={{ flexDirection: 'row', height: WHEEL_HEIGHT }}>
                                <Wheel
                                    data={days}
                                    selected={day}
                                    onChange={setDay}
                                    fontFamily={fontFamily}
                                    activeColor={palette.chrome.primary}
                                    idleColor={palette.brand.text.muted}
                                />
                                <Wheel
                                    data={months}
                                    selected={month}
                                    onChange={setMonth}
                                    fontFamily={fontFamily}
                                    activeColor={palette.chrome.primary}
                                    idleColor={palette.brand.text.muted}
                                />
                                <Wheel
                                    data={years}
                                    selected={year}
                                    onChange={setYear}
                                    fontFamily={fontFamily}
                                    activeColor={palette.chrome.primary}
                                    idleColor={palette.brand.text.muted}
                                />
                            </View>
                            {/* Edge fades so the wheels read as cylinders */}
                            <LinearGradient
                                pointerEvents="none"
                                colors={[card, 'transparent']}
                                style={[styles.fade, { top: 0 }]}
                            />
                            <LinearGradient
                                pointerEvents="none"
                                colors={['transparent', card]}
                                style={[styles.fade, { bottom: 0 }]}
                            />
                        </View>

                        <View style={[styles.footer, { paddingBottom: insets.bottom + scale(12) }]}>
                            <GradientButton
                                title={t('confirm', 'Confirm')}
                                onPress={handleConfirm}
                                widthMode="full"
                                height={40}
                                textSize={15}
                            />
                        </View>
                    </BottomSheetView>
                </BottomSheet>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: scale(20),
        paddingVertical: scale(12),
    },
    sheetTitle: {
        flex: 1,
        fontSize: 14,
        lineHeight: 18,
    },
    wheelArea: {
        height: WHEEL_HEIGHT,
        marginHorizontal: scale(20),
    },
    wheelItem: {
        height: ITEM_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    highlightBand: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: EDGE_PADDING,
        height: ITEM_HEIGHT,
        borderRadius: scale(10),
    },
    fade: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: ITEM_HEIGHT,
    },
    footer: {
        paddingHorizontal: scale(20),
        paddingTop: scale(12),
    },
});
