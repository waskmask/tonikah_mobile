import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Extrapolation,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { Bookmark, X } from 'lucide-react-native';
import { ExploreDeckCard } from './ExploreDeckCard';
import { scale } from '@/hooks/useResponsive';
import { useColors } from '@/hooks/useColors';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { profileId } from '@/lib/exploreProfile';

export type SwipeDirection = 'left' | 'right';

export type SwipeableDeckHandle = {
    /** Fly the top card off screen (same animation as a finger swipe). */
    swipe: (direction: SwipeDirection) => void;
};

type Props = {
    profiles: any[];
    viewerLat?: number | null;
    viewerLng?: number | null;
    onPressCard: () => void;
    /** Called after the top card has left the screen. */
    onSwiped: (direction: SwipeDirection) => void;
    /** Gate check on gesture release; return false to spring the card back. */
    canSwipe: (direction: SwipeDirection) => boolean;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
const FLING_VELOCITY = 900;
const FLY_X = SCREEN_WIDTH * 1.4;
const FLY_DURATION = 280;
const SPRING = { damping: 18, stiffness: 220 };

// Physical directions regardless of RTL: right = save, left = skip —
// matching the action bar where bookmark sits right of the X.
export const SwipeableDeck = forwardRef<SwipeableDeckHandle, Props>(function SwipeableDeck(
    { profiles, viewerLat, viewerLng, onPressCard, onSwiped, canSwipe },
    ref,
) {
    const colors = useColors();
    const reduceMotion = useReducedMotion();
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const [animating, setAnimating] = useState(false);

    const current = profiles[0] || null;
    const next = profiles[1] || null;
    const currentKey = current ? profileId(current) || 'current' : 'empty';

    const finishSwipe = (direction: SwipeDirection) => {
        // Reset before the parent re-renders with the next profile so the new
        // top card mounts centered.
        translateX.value = 0;
        translateY.value = 0;
        setAnimating(false);
        onSwiped(direction);
    };

    const flyOff = (direction: SwipeDirection) => {
        if (reduceMotion) {
            finishSwipe(direction);
            return;
        }
        setAnimating(true);
        translateX.value = withTiming(
            direction === 'right' ? FLY_X : -FLY_X,
            { duration: FLY_DURATION },
            (finished) => {
                if (finished) runOnJS(finishSwipe)(direction);
            },
        );
    };

    const releaseSwipe = (direction: SwipeDirection) => {
        if (!canSwipe(direction)) {
            translateX.value = withSpring(0, SPRING);
            translateY.value = withSpring(0, SPRING);
            return;
        }
        flyOff(direction);
    };

    useImperativeHandle(ref, () => ({
        swipe: (direction: SwipeDirection) => {
            if (animating || !current) return;
            flyOff(direction);
        },
    }));

    const pan = Gesture.Pan()
        .enabled(!animating && Boolean(current))
        // Let taps and vertical wiggles fall through to the card's Pressable
        .activeOffsetX([-12, 12])
        .onUpdate((event) => {
            translateX.value = event.translationX;
            translateY.value = event.translationY * 0.6;
        })
        .onEnd((event) => {
            const byDistance = Math.abs(translateX.value) > SWIPE_THRESHOLD;
            const byVelocity = Math.abs(event.velocityX) > FLING_VELOCITY;
            if (!byDistance && !byVelocity) {
                translateX.value = withSpring(0, SPRING);
                translateY.value = withSpring(0, SPRING);
                return;
            }
            const direction: SwipeDirection = byDistance
                ? (translateX.value > 0 ? 'right' : 'left')
                : (event.velocityX > 0 ? 'right' : 'left');
            runOnJS(releaseSwipe)(direction);
        });

    const topCardStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            {
                rotate: `${interpolate(
                    translateX.value,
                    [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
                    [-11, 0, 11],
                )}deg`,
            },
        ],
    }));

    // Card underneath grows to full size as the top card leaves
    const nextCardStyle = useAnimatedStyle(() => {
        const progress = Math.min(Math.abs(translateX.value) / SWIPE_THRESHOLD, 1);
        return {
            transform: [{ scale: 0.95 + 0.05 * progress }],
        };
    });

    const saveBadgeStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
    }));

    const skipBadgeStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
    }));

    if (!current) return null;

    return (
        <View style={styles.root}>
            {next ? (
                <Animated.View style={[StyleSheet.absoluteFill, nextCardStyle]} pointerEvents="none">
                    <ExploreDeckCard
                        profile={next}
                        viewerLat={viewerLat}
                        viewerLng={viewerLng}
                        onPress={() => undefined}
                    />
                </Animated.View>
            ) : null}
            <GestureDetector gesture={pan}>
                <Animated.View key={currentKey} style={[StyleSheet.absoluteFill, topCardStyle]}>
                    <ExploreDeckCard
                        profile={current}
                        viewerLat={viewerLat}
                        viewerLng={viewerLng}
                        onPress={onPressCard}
                    />
                    <Animated.View
                        pointerEvents="none"
                        style={[styles.swipeBadge, styles.saveBadge, { borderColor: colors.chrome.primary }, saveBadgeStyle]}
                    >
                        <Bookmark size={scale(34)} color={colors.chrome.primary} fill={colors.chrome.primary} />
                    </Animated.View>
                    <Animated.View
                        pointerEvents="none"
                        style={[styles.swipeBadge, styles.skipBadge, { borderColor: colors.chrome.common.iconNeutral }, skipBadgeStyle]}
                    >
                        <X size={scale(34)} color={colors.chrome.common.iconNeutral} strokeWidth={3} />
                    </Animated.View>
                </Animated.View>
            </GestureDetector>
        </View>
    );
});

const styles = StyleSheet.create({
    root: {
        flex: 1,
        position: 'relative',
    },
    swipeBadge: {
        position: 'absolute',
        top: scale(26),
        width: scale(64),
        height: scale(64),
        borderRadius: scale(32),
        borderWidth: scale(3),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.92)',
    },
    saveBadge: {
        left: scale(22),
        transform: [{ rotate: '-10deg' }],
    },
    skipBadge: {
        right: scale(22),
        transform: [{ rotate: '10deg' }],
    },
});
