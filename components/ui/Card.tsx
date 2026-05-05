import React from "react";
import { Pressable, View, ViewProps } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";

interface CardProps extends ViewProps {
    children: React.ReactNode;
    onPress?: () => void;
    className?: string;
}

export const Card: React.FC<CardProps> = ({
    children,
    onPress,
    className = "",
    ...props
}) => {
    const scaleValue = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scaleValue.value }],
    }));

    const handlePressIn = () => {
        if (onPress) scaleValue.value = withSpring(0.98);
    };

    const handlePressOut = () => {
        if (onPress) scaleValue.value = withSpring(1);
    };

    const Content = (
        <View
            className={`bg-white dark:bg-brand-bg-surface rounded-2xl p-4 shadow-sm ${className}`}
            {...props}
        >
            {children}
        </View>
    );

    if (onPress) {
        return (
            <Animated.View style={animatedStyle}>
                <Pressable
                    onPress={onPress}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                >
                    {Content}
                </Pressable>
            </Animated.View>
        );
    }

    return Content;
};
