import React, { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, TextInputProps } from 'react-native';

import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';

type Props = TextInputProps & {
    error?: boolean;
    minInputHeight?: number;
};

/** Shared underline presentation only. Validation, limits, and persistence stay
 * with the owning editor. */
export const UnderlineTextInput = forwardRef<TextInput, Props>(function UnderlineTextInput(
    {
        error = false,
        minInputHeight,
        multiline = false,
        onBlur,
        onFocus,
        style,
        ...props
    },
    ref,
) {
    const colors = useColors();
    const [focused, setFocused] = useState(false);

    return (
        <TextInput
            ref={ref}
            {...props}
            multiline={multiline}
            cursorColor={props.cursorColor ?? colors.chrome.primary}
            selectionColor={props.selectionColor ?? colors.chrome.primary}
            onFocus={(event) => {
                setFocused(true);
                onFocus?.(event);
            }}
            onBlur={(event) => {
                setFocused(false);
                onBlur?.(event);
            }}
            style={[
                styles.base,
                multiline ? styles.multiline : styles.singleLine,
                {
                    minHeight: minInputHeight ?? scale(multiline ? 110 : 44),
                    borderBottomColor: error
                        ? colors.brand.accent.error
                        : focused
                            ? colors.chrome.primary
                            : colors.brand.bg.border,
                    borderBottomWidth: focused ? 1.5 : 1,
                    color: colors.brand.text.body,
                },
                style,
            ]}
        />
    );
});

const styles = StyleSheet.create({
    base: {
        marginTop: scale(6),
        paddingHorizontal: scale(6),
        fontSize: scale(14),
        lineHeight: scale(21),
        includeFontPadding: false,
        backgroundColor: 'transparent',
    },
    singleLine: {
        paddingVertical: 0,
        textAlignVertical: 'center',
    },
    multiline: {
        paddingVertical: scale(8),
        textAlignVertical: 'top',
    },
});
