import React, { useEffect } from "react";
import { View } from "react-native";
import { scale } from "@/hooks/useResponsive";
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from "react-native-reanimated";

interface PaginationDotsProps {
    total: number;
    activeIndex: number;
}

const Dot = ({ active }: { active: boolean }) => {
    const width = useSharedValue(active ? scale(32) : scale(20));

    useEffect(() => {
        width.value = withSpring(active ? scale(32) : scale(20));
    }, [active]);

    const animatedStyle = useAnimatedStyle(() => ({
        width: width.value,
    }));

    return (
        <Animated.View
            className={`h-[6px] rounded-full mx-1 ${active ? "bg-brand-pagination-active" : "bg-brand-pagination-inactive"}`}
            style={animatedStyle}
        />
    );
};

export const PaginationDots: React.FC<PaginationDotsProps> = ({ total, activeIndex }) => {
    return (
        <View className="flex-row justify-center items-center">
            {Array.from({ length: total }).map((_, i) => (
                <Dot key={i} active={i === activeIndex} />
            ))}
        </View>
    );
};
