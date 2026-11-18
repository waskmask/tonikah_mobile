import React, { forwardRef, useLayoutEffect, useImperativeHandle, useRef } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
    cancelAnimation,
    Easing,
    Extrapolation,
    interpolate,
    runOnJS,
    runOnUI,
    type SharedValue,
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
    /** Fly the top card off screen for a button action. */
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
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
const FLY_X = SCREEN_WIDTH * 1.4;
const RESTORE_X = SCREEN_WIDTH * 1.05;
const FLY_DURATION = 235;
const BADGE_DURATION = 200;
const MAX_ROTATION_DEG = 10;
const RESTORE_SPRING = {
    damping: 30,
    stiffness: 260,
    mass: 0.9,
    overshootClamping: true,
    restDisplacementThreshold: 0.5,
    restSpeedThreshold: 5,
};

// Retain the imperative API for X, Save, and Undo; touch drags never advance cards.
export const SwipeableDeck = forwardRef<SwipeableDeckHandle, Props>(function SwipeableDeck(
    { profiles, viewerLat, viewerLng, onPressCard, onSwiped },
    ref,
) {
    const reduceMotion = useReducedMotion();
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const rotationMultiplier = useSharedValue(1);
    const animatingRef = useRef(false);
    const restoreDirectionRef = useRef<SwipeDirection | null>(null);
    const pendingSwipeRef = useRef<string | null>(null);

    const current = profiles[0] || null;
    const next = profiles[1] || null;
    const currentKey = current ? profileId(current) || 'current' : 'empty';
    const currentKeyRef = useRef(currentKey);
    currentKeyRef.current = currentKey;
    const motionOwner = useSharedValue(currentKey);
    const promotedKey = useSharedValue('');
    const badgeDirection = useSharedValue<SwipeDirection | ''>('');
    const badgeProgress = useSharedValue(0);

    const finishSwipe = (direction: SwipeDirection, swipedKey: string) => {
        if (currentKeyRef.current !== swipedKey || pendingSwipeRef.current !== swipedKey) return;
        pendingSwipeRef.current = null;
        badgeDirection.value = '';
        // Keep the outgoing card offscreen and the promoted card full-sized
        // until React commits the parent's optimistic advancement.
        promotedKey.value = next ? profileId(next) : '';
        onSwiped(direction);
    };

    const flyOff = (direction: SwipeDirection) => {
        animatingRef.current = true;
        pendingSwipeRef.current = currentKey;
        badgeDirection.value = direction;
        badgeProgress.value = 0;
        if (reduceMotion) {
            translateX.value = direction === 'right' ? FLY_X : -FLY_X;
            finishSwipe(direction, currentKey);
            return;
        }
        const duration = FLY_DURATION;
        translateY.value = withTiming(0, { duration });
        const startExit = () => {
            'worklet';
            if (motionOwner.value !== currentKey || badgeDirection.value !== direction) return;
            translateX.value = withTiming(
                direction === 'right' ? FLY_X : -FLY_X,
                { duration, easing: Easing.out(Easing.cubic) },
                (finished) => {
                    if (finished) runOnJS(finishSwipe)(direction, currentKey);
                },
            );
        };
        if (direction === 'left') {
            badgeProgress.value = withTiming(1, { duration: BADGE_DURATION, easing: Easing.out(Easing.cubic) }, (finished) => {
                if (finished) startExit();
            });
        } else {
            runOnUI(startExit)();
        }
    };

    const finishRestore = () => {
        animatingRef.current = false;
    };

    useLayoutEffect(() => () => {
        pendingSwipeRef.current = null;
        cancelAnimation(translateX);
        cancelAnimation(translateY);
        cancelAnimation(badgeProgress);
    }, [badgeProgress, translateX, translateY]);

    useLayoutEffect(() => {
        const direction = restoreDirectionRef.current;
        restoreDirectionRef.current = null;
        pendingSwipeRef.current = null;
        // Transfer motion ownership only after the new keyed layers commit.
        // A newly promoted layer never consumes the outgoing card's transform.
        runOnUI(() => {
            'worklet';
            cancelAnimation(translateX);
            cancelAnimation(translateY);
            cancelAnimation(badgeProgress);
            badgeDirection.value = '';
            badgeProgress.value = 0;
            translateX.value = direction ? (direction === 'right' ? RESTORE_X : -RESTORE_X) : 0;
            translateY.value = 0;
            rotationMultiplier.value = 1;
            motionOwner.value = currentKey;
            if (promotedKey.value !== currentKey) promotedKey.value = '';
        })();
        if (!direction) {
            finishRestore();
            return;
        }
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
        },
    }));

    if (!current) return null;

    return (
        <View style={styles.root}>
            {profiles.slice(0, 2).map((profile, index) => (
                <DeckLayer
                    key={profileId(profile) || `card-${index}`}
                    profile={profile}
                    cardKey={profileId(profile) || 'current'}
                    frontKey={currentKey}
                    isTop={index === 0}
                    motionOwner={motionOwner}
                    promotedKey={promotedKey}
                    translateX={translateX}
                    translateY={translateY}
                    rotationMultiplier={rotationMultiplier}
                    badgeDirection={badgeDirection}
                    badgeProgress={badgeProgress}
                    viewerLat={viewerLat}
                    viewerLng={viewerLng}
                    onPress={() => {
                        if (!animatingRef.current) onPressCard();
                    }}
                />
            ))}
        </View>
    );
});

type DeckLayerProps = {
    profile: any;
    cardKey: string;
    frontKey: string;
    isTop: boolean;
    motionOwner: SharedValue<string>;
    promotedKey: SharedValue<string>;
    translateX: SharedValue<number>;
    translateY: SharedValue<number>;
    rotationMultiplier: SharedValue<number>;
    badgeDirection: SharedValue<SwipeDirection | ''>;
    badgeProgress: SharedValue<number>;
    viewerLat?: number | null;
    viewerLng?: number | null;
    onPress: () => void;
};

function DeckLayer({
    profile, cardKey, frontKey, isTop, motionOwner, promotedKey,
    translateX, translateY, rotationMultiplier, badgeDirection, badgeProgress, viewerLat, viewerLng, onPress,
}: DeckLayerProps) {
    const colors = useColors();
    const touchStart = useRef({ x: 0, y: 0 });
    const viewBadgeStyle = useAnimatedStyle(() => ({
        opacity: isTop && motionOwner.value === cardKey && badgeDirection.value === 'right'
            ? interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP) : 0,
    }));
    const skipBadgeStyle = useAnimatedStyle(() => ({
        opacity: isTop && motionOwner.value === cardKey && badgeDirection.value === 'left' ? 1 : 0,
        transform: [{ rotate: '10deg' }, { scale: 0.8 + 0.2 * badgeProgress.value }],
    }));
    const layerStyle = useAnimatedStyle(() => {
        const ownsMotion = isTop && motionOwner.value === cardKey;
        const progress = motionOwner.value === frontKey
            ? Math.min(Math.abs(translateX.value) / SWIPE_THRESHOLD, 1) : 0;
        return {
            transform: [
                { translateX: ownsMotion ? translateX.value : 0 },
                { translateY: ownsMotion ? translateY.value : 0 },
                { rotate: `${ownsMotion ? interpolate(
                    translateX.value * rotationMultiplier.value,
                    [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
                    [-MAX_ROTATION_DEG, 0, MAX_ROTATION_DEG],
                ) : 0}deg` },
                { scale: isTop || promotedKey.value === cardKey ? 1 : 0.95 + 0.05 * progress },
            ],
        };
    });

    return (
        <Animated.View
            pointerEvents={isTop ? 'auto' : 'none'}
            style={[StyleSheet.absoluteFill, { zIndex: isTop ? 1 : 0 }, layerStyle]}
            onStartShouldSetResponderCapture={(event) => {
                touchStart.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
                return false;
            }}
            onMoveShouldSetResponderCapture={(event) => {
                // Cancel the nested card press after a drag, without moving the deck.
                return Math.hypot(event.nativeEvent.pageX - touchStart.current.x,
                    event.nativeEvent.pageY - touchStart.current.y) > 8;
            }}
        >
            <ExploreDeckCard profile={profile} viewerLat={viewerLat} viewerLng={viewerLng} onPress={onPress} />
            <Animated.View pointerEvents="none" style={[styles.swipeBadge, styles.viewBadge,
                { borderColor: colors.chrome.primary }, viewBadgeStyle]}>
                <ArrowFatUp size={scale(36)} color={colors.chrome.primary} weight="fill" />
            </Animated.View>
            <Animated.View pointerEvents="none" style={[styles.swipeBadge, styles.skipBadge,
                { borderColor: colors.chrome.common.iconNeutral }, skipBadgeStyle]}>
                <ExploreSharpX size={34} color={colors.chrome.common.iconNeutral} />
            </Animated.View>
        </Animated.View>
    );
}

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
