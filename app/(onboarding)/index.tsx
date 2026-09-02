import React, { useRef, useState } from "react";
import {
    Dimensions,
    FlatList,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    StyleSheet,
    Text as RNText,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp, ZoomIn } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useLanguage } from "@/hooks/useLanguage";
import { useTheme } from "@/hooks/useTheme";
import { useFirstLaunch } from "@/hooks/useFirstLaunch";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Text } from "@/components/ui/Text";
import { GradientButton } from "@/components/ui/GradientButton";
import { PressableScale } from "@/components/ui/PressableScale";
import { OnboardingBackground } from "@/components/onboarding/OnboardingBackground";
import { HeartLogo } from "@/components/onboarding/HeartLogo";
import { scale, wp, hp, isTablet } from "@/hooks/useResponsive";
import { Typography } from "@/constants/typography";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Design-handoff tokens (hands_off/onboarding_screens) — warm cream / warm
// charcoal palette local to onboarding; the coral accent stays shared.
const TOKENS = {
    light: {
        bg: "#FBF6F0",
        glowColor: "#FF9678",
        glowOpacity: 0.09,
        fg: "#141826",
        eyebrow: "#A2968B",
        muted: "rgba(32,28,40,0.64)",
        wordmark: "#111C3A",
        line: "rgba(96,64,52,0.32)",
        lattice: "rgba(120,80,60,0.10)",
        dot: "rgba(26, 22, 17,0.16)",
        terms: "#141826",
        contrastBtnBg: "#141826",
        contrastBtnText: "#FFFFFF",
    },
    dark: {
        bg: "#141210",
        glowColor: "#FF786E",
        glowOpacity: 0.05,
        fg: "#F4EEE6",
        eyebrow: "#B7A99A",
        muted: "rgba(244,238,230,0.64)",
        wordmark: "#FDF6EE",
        line: "rgba(255,220,200,0.24)",
        lattice: "rgba(255,220,200,0.07)",
        dot: "rgba(255,245,235,0.20)",
        terms: "#F4EEE6",
        contrastBtnBg: "#F4EEE6",
        contrastBtnText: "#141826",
    },
};

// Active-dot gradient matches GradientButton's brand gradient so the CTA pill
// and the page indicator read as one system.
const CORAL_GRADIENT = ["#FF927B", "#F97078", "#F34B6F"] as const;

type SlideType = "welcome" | "marriage" | "intention";

export default function OnboardingScreen() {
    const { t, isRTL } = useLanguage();
    const { completeOnboarding } = useFirstLaunch();
    const { isDark } = useTheme();
    const reduceMotion = useReducedMotion();
    const [activeIndex, setActiveIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const insets = useSafeAreaInsets();
    const tokens = isDark ? TOKENS.dark : TOKENS.light;

    const onboardingData: Array<{ id: string; type: SlideType }> = [
        { id: "1", type: "welcome" },
        { id: "2", type: "marriage" },
        { id: "3", type: "intention" },
    ];

    const displayData = isRTL ? [...onboardingData].reverse() : onboardingData;
    const initialIndex = isRTL ? onboardingData.length - 1 : 0;
    const realIndex = isRTL ? onboardingData.length - 1 - activeIndex : activeIndex;

    const goToReal = (real: number) => {
        const listIndex = isRTL ? onboardingData.length - 1 - real : real;
        flatListRef.current?.scrollToIndex({ index: listIndex, animated: true });
    };

    const handleNext = () => {
        if (realIndex < onboardingData.length - 1) goToReal(realIndex + 1);
    };

    const finish = (target: "/(auth)/login" | "/(auth)/signup") => {
        completeOnboarding();
        router.replace(target);
    };

    const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const newIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        if (newIndex !== activeIndex) setActiveIndex(newIndex);
    };

    const contentMaxWidth = isTablet ? 560 : wp(83);
    const entering = (delay: number) =>
        reduceMotion ? undefined : FadeInUp.duration(550).delay(delay);

    const renderItem = ({ item }: { item: { id: string; type: SlideType } }) => {
        if (item.type === "welcome") {
            return (
                <View style={[styles.slide, styles.slideCentered, { width: SCREEN_WIDTH }]}>
                    <Animated.View
                        entering={reduceMotion ? undefined : ZoomIn.duration(650).springify().damping(13)}
                    >
                        <HeartLogo height={scale(118)} />
                    </Animated.View>
                    <Animated.View entering={entering(120)} style={{ alignItems: "center" }}>
                        <RNText
                            style={[
                                styles.wordmark,
                                { color: tokens.wordmark, fontFamily: Typography.font.heading.extra },
                            ]}
                        >
                            toNikah
                        </RNText>
                        <Text
                            variant="body-sm"
                            className="font-body-semi"
                            style={[styles.tagline, { color: tokens.eyebrow }]}
                        >
                            {t("onboarding.splash_tagline")}
                        </Text>
                    </Animated.View>
                </View>
            );
        }

        const isIntention = item.type === "intention";
        const prefix = isIntention ? "onboarding.screen3" : "onboarding.screen2";

        return (
            <View style={[styles.slide, { width: SCREEN_WIDTH, paddingTop: insets.top + hp(7) }]}>
                <View style={{ width: "100%", maxWidth: contentMaxWidth, alignSelf: "center" }}>
                    <Text
                        variant="body-sm"
                        className="font-body-semi"
                        align="center"
                        style={[styles.eyebrow, { color: tokens.eyebrow }]}
                    >
                        {t(`${prefix}_subtitle`)}
                    </Text>
                    <Text
                        variant="h2"
                        className="font-heading-extra"
                        align="center"
                        style={[styles.headline, { color: tokens.fg }]}
                    >
                        {t(`${prefix}_title`)}
                    </Text>
                    <Text variant="body" align="center" style={[styles.para, { color: tokens.muted }]}>
                        {t(`${prefix}_body1`)}
                    </Text>
                    <Text variant="body" align="center" style={[styles.para, { color: tokens.muted }]}>
                        {t(`${prefix}_body2`)}
                    </Text>

                </View>
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: tokens.bg }}>
            <OnboardingBackground
                tokens={tokens}
                medallionOpacity={realIndex === 0 ? 0.5 : 0.85}
            />

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

            {/* Static bottom bar: CTA + page dots */}
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + hp(1.6) }]}>
                <View style={{ width: "100%", maxWidth: contentMaxWidth, alignSelf: "center" }}>
                    {realIndex === onboardingData.length - 1 ? (
                        <View style={styles.ctaRow}>
                            {/* Dark contrast button (light in dark mode) */}
                            <View style={styles.ctaHalf}>
                                <PressableScale
                                    onPress={() => finish("/(auth)/login")}
                                    activeScale={0.97}
                                    containerStyle={{ width: "100%" }}
                                    // Static style: function-form Pressable styles lose
                                    // backgrounds under the NativeWind interop
                                    style={[styles.contrastButton, { backgroundColor: tokens.contrastBtnBg }]}
                                >
                                    <RNText
                                        style={[
                                            styles.contrastButtonText,
                                            { color: tokens.contrastBtnText, fontFamily: Typography.font.body.bold },
                                        ]}
                                    >
                                        {t("login")}
                                    </RNText>
                                </PressableScale>
                            </View>
                            <View style={styles.ctaHalf}>
                                <GradientButton
                                    title={t("sign_up")}
                                    onPress={() => finish("/(auth)/signup")}
                                    widthMode="full"
                                    height={40}
                                    textSize={15}
                                />
                            </View>
                        </View>
                    ) : (
                        <GradientButton
                            title={realIndex === 0 ? t("onboarding.start") : t("onboarding.next")}
                            onPress={handleNext}
                            widthMode="full"
                            height={40}
                            textSize={15}
                            showChevron
                        />
                    )}
                </View>

                {/* Page dots: active = coral gradient pill */}
                <View style={styles.dotsRow}>
                    {onboardingData.map((_, index) => {
                        const active = index === realIndex;
                        return (
                            <Pressable key={index} onPress={() => goToReal(index)} hitSlop={8}>
                                {active ? (
                                    <LinearGradient
                                        colors={[CORAL_GRADIENT[0], CORAL_GRADIENT[1], CORAL_GRADIENT[2]]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.dotActive}
                                    />
                                ) : (
                                    <View style={[styles.dot, { backgroundColor: tokens.dot }]} />
                                )}
                            </Pressable>
                        );
                    })}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    slide: {
        flex: 1,
        paddingHorizontal: wp(8.5),
        // Leave room for the bottom bar
        paddingBottom: hp(16),
    },
    slideCentered: {
        alignItems: "center",
        justifyContent: "center",
        gap: scale(20),
    },
    wordmark: {
        fontSize: scale(46),
        letterSpacing: -1.2,
        includeFontPadding: false,
        textAlign: "center",
    },
    tagline: {
        fontSize: scale(11),
        letterSpacing: 3.6,
        textTransform: "uppercase",
        textAlign: "center",
        marginTop: scale(10),
    },
    eyebrow: {
        fontSize: scale(11),
        letterSpacing: 3.2,
        textTransform: "uppercase",
        marginBottom: scale(14),
    },
    headline: {
        fontSize: scale(31),
        lineHeight: scale(34),
        letterSpacing: -0.6,
        marginBottom: scale(22),
    },
    para: {
        fontSize: scale(14.5),
        lineHeight: scale(22),
        marginTop: scale(14),
    },
    bottomBar: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: "center",
        paddingHorizontal: wp(8.5),
        zIndex: 10,
        elevation: 10,
    },
    ctaRow: {
        flexDirection: "row",
        gap: scale(12),
        width: "100%",
    },
    ctaHalf: {
        flex: 1,
        minWidth: 0,
    },
    // Same size as the profile-setup GradientButtons (height 40 / text 15)
    contrastButton: {
        width: "100%",
        height: scale(40),
        // Half of height — huge radii can fail to paint on some Android versions
        borderRadius: scale(20),
        alignItems: "center",
        justifyContent: "center",
    },
    contrastButtonText: {
        fontSize: scale(15),
        includeFontPadding: false,
    },
    dotsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(8),
        marginTop: scale(20),
    },
    dot: {
        width: scale(8),
        height: scale(8),
        borderRadius: scale(4),
    },
    dotActive: {
        width: scale(26),
        height: scale(8),
        borderRadius: scale(4),
    },
});
