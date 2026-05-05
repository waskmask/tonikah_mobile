import { Dimensions, PixelRatio } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Base design dimensions (iPhone 13/14 standard)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

export const isTablet = SCREEN_WIDTH > 768;

/**
 * wp: width percentage of screen
 */
export const wp = (percentage: number) => {
    return (percentage * SCREEN_WIDTH) / 100;
};

/**
 * hp: height percentage of screen
 */
export const hp = (percentage: number) => {
    return (percentage * SCREEN_HEIGHT) / 100;
};

/**
 * scale: proportional scaling based on screen width vs 375
 * For tablets (width > 768px): cap scale factor at 1.3x maximum.
 */
export const scale = (size: number) => {
    let scaleFactor = SCREEN_WIDTH / BASE_WIDTH;

    if (isTablet) {
        scaleFactor = Math.min(scaleFactor, 1.3);
    }

    const newSize = size * scaleFactor;
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

/**
 * moderateScale: scale with dampening factor (default 0.5)
 */
export const moderateScale = (size: number, factor = 0.5) => {
    return size + (scale(size) - size) * factor;
};

export const useResponsive = () => {
    return {
        wp,
        hp,
        scale,
        moderateScale,
        isTablet,
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
    };
};

// Also export normalize as an alias for scale
export const normalize = scale;
