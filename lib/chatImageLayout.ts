export function chatImageLayout(width: number | undefined, height: number | undefined, availableWidth: number) {
    const sourceWidth = width && width > 0 ? width : 1;
    const sourceHeight = height && height > 0 ? height : 1;
    const tall = sourceHeight >= sourceWidth * 2;
    const frameWidth = availableWidth * (tall ? 0.6 : 0.78);

    return {
        width: frameWidth,
        height: tall ? frameWidth * 4 / 3 : frameWidth,
        crop: true,
    };
}
