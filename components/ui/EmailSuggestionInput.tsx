import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Input } from './Input';
import { scale } from '@/hooks/useResponsive';
import { useColors } from '@/hooks/useColors';

const DOMAINS = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com'];

type Props = React.ComponentProps<typeof Input>;

/**
 * Email input with provider suggestions. Once the user types "@", common
 * domains appear below; the letters they already typed render bold. Tapping
 * a row completes the address.
 */
export function EmailSuggestionInput({ value, onChangeText, onFocus, onBlur, ...rest }: Props) {
    const colors = useColors();
    const [focused, setFocused] = useState(false);

    const text = value ?? '';
    const atIndex = text.indexOf('@');
    const local = atIndex >= 0 ? text.slice(0, atIndex) : '';
    const domainPart = atIndex >= 0 ? text.slice(atIndex + 1).toLowerCase() : '';

    const matches = focused && atIndex >= 0 && local.length > 0
        ? DOMAINS.filter((domain) => domain.startsWith(domainPart) && domain !== domainPart)
        : [];

    return (
        <View style={styles.wrap}>
            <Input
                {...rest}
                value={value}
                onChangeText={onChangeText}
                onFocus={(e) => {
                    setFocused(true);
                    onFocus?.(e);
                }}
                onBlur={(e) => {
                    // Delay so a tap on a suggestion lands before the list hides
                    setTimeout(() => setFocused(false), 150);
                    onBlur?.(e);
                }}
            />
            {matches.length > 0 ? (
                <View
                    style={[
                        styles.dropdown,
                        {
                            backgroundColor: colors.chrome.common.card,
                            borderColor: colors.brand.bg.border,
                            shadowColor: colors.chrome.common.shadow,
                        },
                    ]}
                >
                    {matches.map((domain) => (
                        <Pressable
                            key={domain}
                            onPress={() => onChangeText?.(`${local}@${domain}`)}
                            style={styles.option}
                        >
                            {/* Full completed address: everything the user already typed
                                (waseem@gma) bold, the suggested remainder (il.com) soft */}
                            <Text
                                variant="body-sm"
                                numberOfLines={1}
                                style={[styles.optionText, { color: colors.brand.text.subtitle }]}
                            >
                                <Text variant="body-sm" className="font-body-bold" style={{ color: colors.brand.text.body }}>
                                    {local}@{domain.slice(0, domainPart.length)}
                                </Text>
                                <Text variant="body-sm" style={{ color: colors.brand.text.subtitle }}>
                                    {domain.slice(domainPart.length)}
                                </Text>
                            </Text>
                        </Pressable>
                    ))}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        width: '100%',
        position: 'relative',
        zIndex: 30,
    },
    dropdown: {
        position: 'absolute',
        top: scale(48),
        left: 0,
        right: 0,
        borderWidth: 1,
        borderRadius: scale(14),
        overflow: 'hidden',
        // Uniform breathing room on all four sides
        padding: scale(6),
        zIndex: 30,
        elevation: 8,
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: scale(9),
        paddingHorizontal: scale(12),
        borderRadius: scale(10),
    },
    // Email addresses always read LTR, even in RTL locales
    optionText: {
        writingDirection: 'ltr',
        textAlign: 'left',
    },
});
