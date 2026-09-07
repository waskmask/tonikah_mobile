import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { t } from '@/lib/profileDisplay';

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
}: RangeRowProps) {
    const [trackWidth, setTrackWidth] = useState(0);
    const isAny = valueMin === defaultMin && valueMax === defaultMax;
    const minLabel = formatValue ? formatValue(valueMin) : `${valueMin}${unit ? ` ${unit}` : ''}`;
    const maxLabel = formatValue ? formatValue(valueMax) : `${valueMax}${unit ? ` ${unit}` : ''}`;
    const valueText = isAny ? (anyLabel ?? t('any', 'Any')) : `${minLabel} - ${maxLabel}`;
    const minPct = ((valueMin - min) / (max - min)) * 100;
    const maxPct = ((valueMax - min) / (max - min)) * 100;

    const setValueFromX = (x: number) => {
        if (!trackWidth) return;
        const raw = min + (Math.max(0, Math.min(trackWidth, x)) / trackWidth) * (max - min);
        const nextValue = Math.round(raw / step) * step;
        const distanceToMin = Math.abs(nextValue - valueMin);
        const distanceToMax = Math.abs(nextValue - valueMax);
        if (distanceToMin <= distanceToMax) {
            onChange(Math.min(nextValue, valueMax - step), valueMax);
        } else {
            onChange(valueMin, Math.max(nextValue, valueMin + step));
        }
    };

    return (
        <View
            style={[styles.rangeCard, { backgroundColor: cardColor, borderColor }]}
            accessibilityRole="adjustable"
            accessibilityLabel={label}
            accessibilityValue={{ text: valueText }}
        >
            <View style={styles.rangeHeader}>
                <Text variant="body-sm" className="font-body-bold" style={styles.rangeTitle}>{label}</Text>
                <Text variant="body-sm" className="font-body-semi" style={[styles.rangeValue, { color: isAny ? mutedColor : primaryColor }]}>
                    {valueText}
                </Text>
            </View>
            <View
                style={styles.sliderBox}
                onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={(event) => setValueFromX(event.nativeEvent.locationX)}
                onResponderMove={(event) => setValueFromX(event.nativeEvent.locationX)}
            >
                <View style={[styles.sliderTrack, { backgroundColor: isDark ? '#3A332B' : '#E4E8ED' }]} />
                <View
                    style={[
                        styles.sliderActiveTrack,
                        {
                            left: `${minPct}%`,
                            right: `${100 - maxPct}%`,
                            backgroundColor: primaryColor,
                        },
                    ]}
                />
                <View style={[styles.sliderThumb, { left: `${minPct}%`, borderColor: primaryColor, shadowColor: primaryColor }]} />
                <View style={[styles.sliderThumb, { left: `${maxPct}%`, borderColor: primaryColor, shadowColor: primaryColor }]} />
            </View>
            <View style={styles.rangeValues}>
                <Text variant="caption" className="font-body-semi" style={{ color: isDark ? '#A99C8D' : mutedColor }}>
                    {formatValue ? formatValue(min) : String(min)}
                </Text>
                <Text variant="caption" className="font-body-semi" style={{ color: isDark ? '#A99C8D' : mutedColor }}>
                    {formatValue ? formatValue(max) : String(max)}
                </Text>
            </View>
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
    rangeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
    },
    rangeTitle: {
        fontSize: 14,
        lineHeight: 20,
    },
    rangeValue: {
        fontSize: 14,
        lineHeight: 20,
    },
    // Numeric ranges keep LTR orientation in RTL locales (like media controls)
    sliderBox: {
        height: 24,
        justifyContent: 'center',
        marginHorizontal: 12,
        direction: 'ltr',
    },
    sliderTrack: {
        height: 4,
        borderRadius: 2,
    },
    sliderActiveTrack: {
        position: 'absolute',
        height: 4,
        borderRadius: 2,
    },
    sliderThumb: {
        position: 'absolute',
        width: 24,
        height: 24,
        marginLeft: -12,
        borderRadius: 12,
        borderWidth: 2.5,
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
