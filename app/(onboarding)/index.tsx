import React, { useState, useRef } from "react";
import { View, FlatList, Dimensions, NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "@/hooks/useLanguage";
import { useFirstLaunch } from "@/hooks/useFirstLaunch";
import { Text } from "@/components/ui/Text";
import { GradientButton } from "@/components/ui/GradientButton";
import { PaginationDots } from "@/components/ui/PaginationDots";
import { scale, wp, hp } from "@/hooks/useResponsive";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { useTheme } from "@/hooks/useTheme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function OnboardingScreen() {
    const { t, isRTL } = useLanguage();
    const { completeOnboarding } = useFirstLaunch();
    const { isDark } = useTheme();
    const [activeIndex, setActiveIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const insets = useSafeAreaInsets();

    // Setup fade animation for button text
    const fadeAnim = useRef(new Animated.Value(1)).current;

    const onboardingData = [
        {
            id: "1",
            type: "welcome",
            title: "toNikah",
        },
        {
            id: "2",
            type: "marriage",
            subtitle: t("onboarding.screen2_subtitle"),
            title: t("onboarding.screen2_title"),
            body1: t("onboarding.screen2_body1"),
            body2: t("onboarding.screen2_body2"),
        },
        {
            id: "3",
            type: "intention",
            subtitle: t("onboarding.screen3_subtitle"),
            title: t("onboarding.screen3_title"),
            body1: t("onboarding.screen3_body1"),
            body2: t("onboarding.screen3_body2"),
        },
    ];

    const displayData = isRTL ? [...onboardingData].reverse() : onboardingData;
    const initialIndex = isRTL ? onboardingData.length - 1 : 0;

    const handleNext = () => {
        const nextIndex = isRTL ? activeIndex - 1 : activeIndex + 1;
        if (isRTL ? nextIndex >= 0 : nextIndex < onboardingData.length) {
            flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        } else {
            completeOnboarding();
            router.replace("/(auth)/register");
        }
    };

    const updateActiveIndexWithAnimation = (newIndex: number) => {
        if (newIndex !== activeIndex) {
            // Fade out
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }).start(() => {
                // Change index
                setActiveIndex(newIndex);
                // Fade in
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 150,
                    useNativeDriver: true,
                }).start();
            });
        }
    };

    const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const newIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        updateActiveIndexWithAnimation(newIndex);
    };

    const openTerms = () => {
        WebBrowser.openBrowserAsync("https://tonikah.com/terms");
    };

    const renderItem = ({ item }: { item: any }) => {
        if (item.type === "welcome") {
            return (
                <View style={[styles.slide, { width: SCREEN_WIDTH }]} className="bg-white dark:bg-slate-900">
                    <View style={styles.centerContent}>
                        <Image
                            source={isDark ? require("@/assets/images/logo-dark.png") : require("@/assets/images/logo-light.png")}
                            style={{ width: wp(50), height: wp(50), marginBottom: scale(60) }} // Push logo up slightly to balance empty bottom space
                            contentFit="contain"
                        />
                    </View>
                </View>
            );
        }

        return (
            <View style={[styles.slide, { width: SCREEN_WIDTH }]} className="bg-white dark:bg-slate-900">
                <Image
                    source={require("@/assets/images/couple-illustration.png")}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    contentPosition="bottom"
                />
                <View style={[styles.textOverlay, { paddingTop: insets.top + scale(24) }]}>
                    <Text variant="subtitle" align="center" className="uppercase tracking-widest">
                        {item.subtitle}
                    </Text>
                    <Text variant="h2" align="center" className="mt-2">
                        {item.title}
                    </Text>
                    <Text variant="body" align="center" className="mt-6 leading-6">
                        {item.body1}
                    </Text>
                    <Text variant="body" align="center" className="mt-4 leading-6">
                        {item.body2}
                    </Text>

                    {item.type === "intention" && (
                        <View className="mt-4 flex-row flex-wrap justify-center">
                            <Text variant="body" align="center">
                                {t("onboarding.screen3_terms_prefix")}{" "}
                            </Text>
                            <Pressable onPress={openTerms}>
                                <Text variant="body" className="text-[#4B68C4] underline">
                                    {t("onboarding.screen3_terms_link")}
                                </Text>
                            </Pressable>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    // Calculate current button text
    const realIndex = isRTL ? onboardingData.length - 1 - activeIndex : activeIndex;
    let buttonText = t("onboarding.next");
    if (onboardingData[realIndex].type === "welcome") {
        buttonText = t("onboarding.start");
    } else if (onboardingData[realIndex].type === "intention") {
        buttonText = t("onboarding.bismillah");
    }

    return (
        <View style={{ flex: 1 }} className="bg-white dark:bg-slate-900">
            {/* Sliding Content */}
            <FlatList
                ref={flatListRef}
                data={displayData}
                renderItem={renderItem}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onMomentumScrollEnd}
                keyExtractor={(item) => item.id}
                initialScrollIndex={initialIndex}
                getItemLayout={(data, index) => ({
                    length: SCREEN_WIDTH,
                    offset: SCREEN_WIDTH * index,
                    index,
                })}
            />

            {/* STATIC BOTTOM BAR */}
            <View
                style={[
                    styles.bottomBar,
                    { paddingBottom: insets.bottom + scale(20) },
                ]}
            >
                <Animated.View style={{ opacity: fadeAnim, width: "100%", alignItems: "center" }}>
                    <GradientButton
                        title={buttonText}
                        onPress={handleNext}
                        showChevron
                    />
                </Animated.View>

                <View style={{ marginTop: scale(16) }}>
                    <PaginationDots total={3} activeIndex={realIndex} />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    slide: {
        flex: 1,
    },
    centerContent: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    textOverlay: {
        paddingHorizontal: 24,
        alignItems: "center",
    },
    bottomBar: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: "center",
        paddingHorizontal: 16,
        // Ensure it sits above the FlatList content
        zIndex: 10,
        elevation: 10,
    },
});
