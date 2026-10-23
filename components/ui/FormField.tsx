import React, { useCallback, useEffect, useRef } from 'react';
import { View, Pressable, StyleSheet, Keyboard, TextInput, type EmitterSubscription } from 'react-native';
import { Text } from './Text';
import { scale } from '@/hooks/useResponsive';
import { useTheme } from '@/hooks/useTheme';
import { fontFamilyForText } from '@/constants/typography';
import { t } from '@/lib/profileDisplay';

type PendingSelectionOpen = { listener?: EmitterSubscription; timer?: ReturnType<typeof setTimeout> };

/** Field label with optional red asterisk */
export function FieldLabel({ text, required }: { text: string; required?: boolean }) {
    return (
        <View style={{ flexDirection: 'row', marginBottom: scale(6), marginTop: scale(12) }}>
            <Text variant="body-sm" className="font-medium">{text}</Text>
            {required && <Text variant="body-sm" style={{ color: '#EF4444', marginStart: 2 }}> *</Text>}
        </View>
    );
}

/** Error message text — rendered absolutely inside the gap below the field so
    it never pushes the layout */
export function ErrorText({ text }: { text: string }) {
    return (
        <View style={{ height: 0, zIndex: 1 }} pointerEvents="none">
            <Text
                variant="caption"
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
                numberOfLines={1}
                style={{
                    position: 'absolute',
                    top: scale(3),
                    left: scale(6),
                    right: scale(6),
                    color: '#EF4444',
                    fontSize: scale(12),
                    textAlign: 'left',
                }}
            >
                {text}
            </Text>
        </View>
    );
}

/** Pressable select field that looks like an input with icon on the right (flips in RTL) */
export function SelectField({
    value,
    placeholder,
    onPress,
    icon,
    hasError,
    required,
}: {
    value: string;
    placeholder: string;
    onPress: () => void;
    icon: React.ReactNode;
    hasError?: boolean;
    /** Appends an asterisk to the placeholder (labels were removed from the flow) */
    required?: boolean;
}) {
    const { isDark } = useTheme();
    // Mirror the auth Input exactly: 14pt; placeholder regular (light),
    // selected value semibold (600 — Jakarta's 500 reads too close to 400)
    const displayedValue = value || (required ? `${placeholder} *` : placeholder);
    const valueFont = fontFamilyForText(displayedValue, value ? 'semi' : 'regular');
    const pendingOpen = useRef<PendingSelectionOpen | null>(null);
    const latestOnPress = useRef(onPress);
    latestOnPress.current = onPress;
    const cancelPendingOpen = useCallback(() => {
        const pending = pendingOpen.current;
        pendingOpen.current = null;
        pending?.listener?.remove();
        if (pending?.timer) clearTimeout(pending.timer);
    }, []);
    useEffect(() => cancelPendingOpen, [cancelPendingOpen]);

    const openSelection = () => {
        if (pendingOpen.current) return;
        if (!Keyboard.isVisible() && !TextInput.State.currentlyFocusedInput()) {
            onPress();
            return;
        }
        // Present native modals after keyboard layout settles, with a fallback
        // for keyboards that don't emit a hide event.
        const finish = () => {
            if (!pendingOpen.current) return;
            cancelPendingOpen();
            latestOnPress.current();
        };
        const pending: PendingSelectionOpen = {};
        pendingOpen.current = pending;
        pending.listener = Keyboard.addListener('keyboardDidHide', finish);
        pending.timer = setTimeout(finish, 500);
        Keyboard.dismiss();
    };

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${placeholder}: ${value || t('not_set', 'Not set')}`}
            accessibilityHint={t('opens_selection_options', 'Opens selection options')}
            onPress={openSelection}
            hitSlop={{ top: 8, bottom: 8 }}
            style={[
                {
                    flexDirection: 'row',
                    alignItems: 'center',
                    // Underline style matching the auth Input: bottom border only
                    borderBottomWidth: 1,
                    paddingHorizontal: scale(6),
                    height: scale(44),
                    minHeight: 44,
                    width: '100%',
                    // Labels are gone — fields need their own breathing room
                    // (error text renders absolutely inside this gap)
                    marginTop: scale(22),
                    backgroundColor: 'transparent',
                    borderBottomColor: hasError ? '#EF4444' : isDark ? '#303033' : '#EEEEEE',
                },
            ]}
        >
            <View pointerEvents="none" style={{ flex: 1, height: '100%', flexDirection: 'row', alignItems: 'center', gap: scale(10) }}>
                <Text
                    variant="body"
                    numberOfLines={1}
                    style={[
                        {
                            flex: 1,
                            textAlign: 'left',
                            fontSize: scale(15),
                            fontFamily: valueFont,
                        },
                        value
                            ? { color: isDark ? '#E5E5E7' : '#201B15' }
                            : { color: isDark ? '#B0B0B5' : '#5C5348' },
                    ]}
                >
                    {displayedValue}
                </Text>
                {icon}
            </View>
        </Pressable>
    );
}
