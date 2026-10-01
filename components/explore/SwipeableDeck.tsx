import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    cancelAnimation,
    Extrapolation,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { ArrowFatUp } from 'phosphor-react-native';
import { ExploreDeckCard } from './ExploreDeckCard';
import { ExploreSharpX } from './ExploreActionBar';
import { scale } from '@/hooks/useResponsive';
import { useColors } from '@/hooks/useColors';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { profileId } from '@/lib/exploreProfile';

export type SwipeDirection = 'left' | 'right';

export type SwipeableDeckHandle = {
    /** Fly the top card off screen (same animation as a finger swipe). */
    swipe: (direction: SwipeDirection) => void;
    /** Place the restored card off screen before React adds it back to the deck. */
    prepareRestore: (direction: SwipeDirection) => void;
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
const VERTICAL_OPEN_THRESHOLD = 36;
const VERTICAL_FLING_VELOCITY = 650;
const FLY_X = SCREEN_WIDTH * 1.4;
const RESTORE_X = SCREEN_WIDTH * 1.05;
const FLY_DURATION = 235;
const MAX_ROTATION_DEG = 10;
const RETURN_SPRING = {
    damping: 30,
    stiffness: 320,
    mass: 0.9,
    overshootClamping: true,
    restDisplacementThreshold: 0.5,
    restSpeedThreshold: 5,
};
const RESTORE_SPRING = {
    damping: 30,
    stiffness: 260,
    mass: 0.9,
    overshootClamping: true,
    restDisplacementThreshold: 0.5,
    restSpeedThreshold: 5,
};

// Gesture-left skips and gesture-right opens the profile. Programmatic right
// remains the Save button's exit animation.
export const SwipeableDeck = forwardRef<SwipeableDeckHandle, Props>(function SwipeableDeck(
    { profiles, viewerLat, viewerLng, onPressCard, onSwiped, canSwipe },
    ref,
) {
    const colors = useColors();
    const reduceMotion = useReducedMotion();
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const deckHeight = useSharedValue(1);
    const rotationMultiplier = useSharedValue(1);
    const gestureAxis = useSharedValue<0 | 1 | 2>(0);
    const [animating, setAnimating] = useState(false);
    const animatingRef = useRef(false);
    const restoreDirectionRef = useRef<SwipeDirection | null>(null);

    const current = profiles[0] || null;
    const next = profiles[1] || null;
    const currentKey = current ? profileId(current) || 'current' : 'empty';

    const finishSwipe = (direction: SwipeDirection) => {
        // Reset before the parent re-renders with the next profile so the new
        // top card mounts centered.
        translateX.value = 0;
        translateY.value = 0;
        rotationMultiplier.value = 1;
        animatingRef.current = false;
        setAnimating(false);
        onSwiped(direction);
    };

    const flyOff = (direction: SwipeDirection, velocityX = 0, velocityY = 0) => {
        if (reduceMotion) {
            finishSwipe(direction);
            return;
        }
        animatingRef.current = true;
        setAnimating(true);
        const speed = Math.abs(velocityX);
        const duration = speed > 0
            ? Math.max(175, Math.min(FLY_DURATION, Math.round((SCREEN_WIDTH / speed) * 1000)))
            : FLY_DURATION;
        const projectedY = Math.max(-scale(120), Math.min(scale(120), translateY.value + velocityY * 0.08));
        translateY.value = withTiming(projectedY, { duration });
        translateX.value = withTiming(
            direction === 'right' ? FLY_X : -FLY_X,
            { duration },
            (finished) => {
                if (finished) runOnJS(finishSwipe)(direction);
            },
        );
    };

    const releaseSwipe = (direction: SwipeDirection, velocityX: number, velocityY: number) => {
        if (!canSwipe(direction)) {
            translateX.value = withSpring(0, RETURN_SPRING);
            translateY.value = withSpring(0, RETURN_SPRING);
            return;
        }
        flyOff(direction, velocityX, velocityY);
    };

    const finishRestore = () => {
        animatingRef.current = false;
        setAnimating(false);
    };

    useEffect(() => {
        const direction = restoreDirectionRef.current;
        if (!direction) return;
        restoreDirectionRef.current = null;
        if (reduceMotion) {
            translateX.value = 0;
            translateY.value = 0;
            finishRestore();
            return;
        }
        translateY.value = withSpring(0, RESTORE_SPRING);
        translateX.value = withSpring(0, RESTORE_SPRING, (finished) => {
            if (finished) runOnJS(finishRestore)();
        });
        // The profile key is the signal that React has mounted the restored card.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentKey]);

    useImperativeHandle(ref, () => ({
        swipe: (direction: SwipeDirection) => {
            if (animatingRef.current || !current) return;
            flyOff(direction);
        },
        prepareRestore: (direction: SwipeDirection) => {
            if (animatingRef.current) return;
            restoreDirectionRef.current = direction;
            animatingRef.current = true;
            setAnimating(true);
            rotationMultiplier.value = 1;
            translateY.value = 0;
            translateX.value = direction === 'right' ? RESTORE_X : -RESTORE_X;
        },
    }));

    const pan = Gesture.Pan()
        .enabled(!animating && Boolean(current))
        .minDistance(8)
        .onBegin((event) => {
            cancelAnimation(translateX);
            cancelAnimation(translateY);
            gestureAxis.value = 0;
            rotationMultiplier.value = event.y <= deckHeight.value / 2 ? 1 : -1;
        })
        .onUpdate((event) => {
            const absX = Math.abs(event.translationX);
            const absY = Math.abs(event.translationY);
            if (gestureAxis.value === 0 && absX + absY >= 8) {
                gestureAxis.value = absX >= absY * 1.08 ? 1 : 2;
            }

            if (gestureAxis.value === 1) {
                translateX.value = event.translationX;
                translateY.value = interpolate(
                    event.translationY,
                    [-180, 0, 180],
                    [-14, 0, 14],
                    Extrapolation.CLAMP,
                );
            } else {
                translateX.value = interpolate(
                    event.translationX,
                    [-80, 0, 80],
                    [-4, 0, 4],
                    Extrapolation.CLAMP,
                );
                translateY.value = interpolate(
                    event.translationY,
                    [-160, 0, 160],
                    [-12, 0, 12],
                    Extrapolation.CLAMP,
                );
            }
        })
        .onEnd((event) => {
            const horizontal = gestureAxis.value === 1;
            gestureAxis.value = 0;

            if (!horizontal) {
                translateX.value = withSpring(0, RETURN_SPRING);
                translateY.value = withSpring(0, RETURN_SPRING);
                const openFromScroll =
                    event.translationY < -VERTICAL_OPEN_THRESHOLD
                    || event.velocityY < -VERTICAL_FLING_VELOCITY;
                if (openFromScroll) runOnJS(onPressCard)();
                return;
            }

            const projectedX = event.translationX + event.velocityX * 0.16;
            const byDistance = Math.abs(event.translationX) > SWIPE_THRESHOLD;
            const byVelocity = Math.abs(event.translationX) > scale(24)
                && Math.abs(event.velocityX) > FLING_VELOCITY
                && Math.abs(projectedX) > SWIPE_THRESHOLD;
            if (!byDistance && !byVelocity) {
                translateX.value = withSpring(0, RETURN_SPRING);
                translateY.value = withSpring(0, RETURN_SPRING);
                return;
            }

            const direction: SwipeDirection = byDistance
                ? (event.translationX > 0 ? 'right' : 'left')
                : (projectedX > 0 ? 'right' : 'left');

            if (direction === 'right') {
                translateX.value = withSpring(0, RETURN_SPRING);
                translateY.value = withSpring(0, RETURN_SPRING);
                runOnJS(onPressCard)();
                return;
            }

            runOnJS(releaseSwipe)('left', event.velocityX, event.velocityY);
        })
        .onFinalize((_event, success) => {
            if (success) return;
            gestureAxis.value = 0;
            translateX.value = withSpring(0, RETURN_SPRING);
            translateY.value = withSpring(0, RETURN_SPRING);
        });

    const topCardStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            {
                rotate: `${interpolate(
                    translateX.value * rotationMultiplier.value,
                    [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
                    [-MAX_ROTATION_DEG, 0, MAX_ROTATION_DEG],
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

    const viewBadgeStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
    }));

    const skipBadgeStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
    }));

    if (!current) return null;

    return (
        <View
            style={styles.root}
            onLayout={(event) => {
                deckHeight.value = event.nativeEvent.layout.height;
            }}
        >
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
                        style={[styles.swipeBadge, styles.viewBadge, { borderColor: colors.chrome.primary }, viewBadgeStyle]}
                    >
                        <ArrowFatUp size={scale(36)} color={colors.chrome.primary} weight="fill" />
                    </Animated.View>
                    <Animated.View
                        pointerEvents="none"
                        style={[styles.swipeBadge, styles.skipBadge, { borderColor: colors.chrome.common.iconNeutral }, skipBadgeStyle]}
                    >
                        <ExploreSharpX size={34} color={colors.chrome.common.iconNeutral} />
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
    viewBadge: {
        left: scale(22),
        transform: [{ rotate: '-10deg' }],
    },
    skipBadge: {
        right: scale(22),
        transform: [{ rotate: '10deg' }],
    },
});
