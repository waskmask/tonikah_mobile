import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { t } from '@/lib/profileDisplay';
import { useLanguage } from '@/hooks/useLanguage';
import { localeUsesLatinScript } from '@/lib/textDirection';

type RangeRowProps = {
    label: string;
    min: number;
    max: number;
    step: number;
    unit?: string;
    valueMin: number;
    valueMax: number;
    defaultMin: number;
    defaultMax: number;
    formatValue?: (value: number) => string;
    onChange: (min: number, max: number) => void;
    isDark: boolean;
    primaryColor: string;
    borderColor: string;
    cardColor: string;
    mutedColor: string;
    /** Label shown when the full range is selected (default: t('any')). */
    anyLabel?: string;
    /** Unframed, divider-based treatment used by full-width editing surfaces. */
    presentation?: 'card' | 'band';
    insetDivider?: boolean;
    isRTL?: boolean;
};

/** Dual-thumb range slider card, shared by the explore filters and the
    partner-preference editor. Thumbs can never cross (min gap = step). */
export function RangeRow({
    label,
    min,
    max,
    step,
    unit,
    valueMin,
    valueMax,
    defaultMin,
    defaultMax,
    formatValue,
    onChange,
    isDark,
    primaryColor,
    borderColor,
    cardColor,
    mutedColor,
    anyLabel,
    presentation = 'card',
    insetDivider = false,
    isRTL = false,
}: RangeRowProps) {
    const { currentLanguage } = useLanguage();
    const usesLatinLabels = localeUsesLatinScript(currentLanguage);
    const [trackWidth, setTrackWidth] = useState(0);
    const isAny = valueMin === defaultMin && valueMax === defaultMax;
    const minLabel = formatValue ? formatValue(valueMin) : `${valueMin}${unit ? ` ${unit}` : ''}`;
    const maxLabel = formatValue ? formatValue(valueMax) : `${valueMax}${unit ? ` ${unit}` : ''}`;
    const valueText = isAny ? (anyLabel ?? t('any', 'Any')) : `${minLabel} - ${maxLabel}`;
    const minPct = ((valueMin - min) / (max - min)) * 100;
    const maxPct = ((valueMax - min) / (max - min)) * 100;
    const activeThumbRef = useRef<'min' | 'max' | null>(null);
    const trackPageXRef = useRef(0);
    const valuesRef = useRef({ min: valueMin, max: valueMax });
    valuesRef.current = { min: valueMin, max: valueMax };

    const valueFromX = (x: number) => {
        if (!trackWidth) return;
        const raw = min + (Math.max(0, Math.min(trackWidth, x)) / trackWidth) * (max - min);
        return min + Math.round((raw - min) / step) * step;
    };

    const beginDrag = (x: number) => {
        const nextValue = valueFromX(x);
        if (nextValue == null) return;
        const current = valuesRef.current;
        activeThumbRef.current = Math.abs(nextValue - current.min) <= Math.abs(nextValue - current.max)
            ? 'min'
            : 'max';
        updateDrag(x);
    };

    const updateDrag = (x: number) => {
        const nextValue = valueFromX(x);
        if (nextValue == null || !activeThumbRef.current) return;
        const current = valuesRef.current;
        if (activeThumbRef.current === 'min') {
            const nextMin = Math.min(nextValue, current.max - step);
            valuesRef.current = { min: nextMin, max: current.max };
            onChange(nextMin, current.max);
        } else {
            const nextMax = Math.max(nextValue, current.min + step);
            valuesRef.current = { min: current.min, max: nextMax };
            onChange(current.min, nextMax);
        }
    };

    const endDrag = () => {
        activeThumbRef.current = null;
    };

    const dragHandlersRef = useRef({ beginDrag, updateDrag, endDrag });
    dragHandlersRef.current = { beginDrag, updateDrag, endDrag };
    const panResponder = useMemo(
        () => PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onStartShouldSetPanResponderCapture: () => true,
            onMoveShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponderCapture: () => true,
            onPanResponderTerminationRequest: () => false,
            onPanResponderGrant: (event) => {
                const { locationX, pageX } = event.nativeEvent;
                trackPageXRef.current = pageX - locationX;
                dragHandlersRef.current.beginDrag(locationX);
            },
            onPanResponderMove: (event) => {
                dragHandlersRef.current.updateDrag(event.nativeEvent.pageX - trackPageXRef.current);
            },
            onPanResponderRelease: () => dragHandlersRef.current.endDrag(),
            onPanResponderTerminate: () => dragHandlersRef.current.endDrag(),
        }),
        [],
    );

    return (
        <View
            style={[
                presentation === 'band' ? styles.rangeBand : styles.rangeCard,
                presentation === 'band' && insetDivider && styles.rangeBandInset,
                {
                    backgroundColor: presentation === 'band' ? 'transparent' : cardColor,
                    borderColor,
                },
            ]}
            accessibilityRole="adjustable"
            accessibilityLabel={label}
            accessibilityValue={{ text: valueText }}
        >
            <View style={styles.rangeHeader}>
                <Text
                    variant="body-sm"
                    className="font-body-bold"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.86}
                    style={[
                        styles.rangeTitle,
                        usesLatinLabels ? styles.latinFieldLabel : styles.naturalFieldLabel,
                        { color: mutedColor, textAlign: isRTL ? 'right' : 'left' },
                    ]}
                >
                    {label}
                </Text>
                <Text variant="body-sm" className="font-body-semi" style={[styles.rangeValue, { color: isAny ? mutedColor : primaryColor, textAlign: isRTL ? 'left' : 'right' }]}>
                    {valueText}
                </Text>
            </View>
            <View
                style={styles.sliderBox}
                onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
                {...panResponder.panHandlers}
            >
                <View pointerEvents="none" style={[styles.sliderTrack, { backgroundColor: isDark ? '#303033' : '#E4E8ED' }]} />
                <View
                    pointerEvents="none"
                    style={[
                        styles.sliderActiveTrack,
                        {
                            left: `${minPct}%`,
                            right: `${100 - maxPct}%`,
                            backgroundColor: primaryColor,
                        },
                    ]}
                />
                <View pointerEvents="none" style={[styles.sliderThumb, { left: `${minPct}%`, borderColor: primaryColor, shadowColor: primaryColor }]} />
                <View pointerEvents="none" style={[styles.sliderThumb, { left: `${maxPct}%`, borderColor: primaryColor, shadowColor: primaryColor }]} />
            </View>
            <View style={styles.rangeValues}>
                <Text variant="caption" className="font-body-semi" style={{ color: isDark ? '#B0B0B5' : mutedColor }}>
                    {formatValue ? formatValue(min) : String(min)}
                </Text>
                <Text variant="caption" className="font-body-semi" style={{ color: isDark ? '#B0B0B5' : mutedColor }}>
                    {formatValue ? formatValue(max) : String(max)}
                </Text>
            </View>
            {presentation === 'band' && insetDivider ? (
                <View
                    pointerEvents="none"
                    style={[styles.insetDivider, { backgroundColor: borderColor }]}
                />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    rangeCard: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 12,
        minHeight: 112,
    },
    rangeBand: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 12,
        minHeight: 112,
    },
    rangeBandInset: {
        borderBottomWidth: 0,
        position: 'relative',
    },
    insetDivider: {
        position: 'absolute',
        start: 16,
        end: 16,
        bottom: 0,
        height: StyleSheet.hairlineWidth,
    },
    rangeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
    },
    rangeTitle: {
        flex: 1,
        minWidth: 0,
        fontSize: 13,
        lineHeight: 17,
    },
    latinFieldLabel: {
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
    naturalFieldLabel: {
        letterSpacing: 0,
        textTransform: 'none',
    },
    rangeValue: {
        flexShrink: 0,
        fontSize: 14,
        lineHeight: 20,
    },
    // Numeric ranges keep LTR orientation in RTL locales (like media controls)
    sliderBox: {
        height: 30,
        justifyContent: 'center',
        marginHorizontal: 15,
        direction: 'ltr',
    },
    sliderTrack: {
        height: 3,
        borderRadius: 2,
    },
    sliderActiveTrack: {
        position: 'absolute',
        height: 3,
        borderRadius: 2,
    },
    sliderThumb: {
        position: 'absolute',
        width: 30,
        height: 30,
        marginLeft: -15,
        borderRadius: 15,
        borderWidth: 1,
        backgroundColor: '#FFFFFF',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
    },
    rangeValues: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 6,
        direction: 'ltr',
    },
});
