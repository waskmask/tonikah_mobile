export type CropRect = { x: number; y: number; width: number; height: number };
export type ImageSize = { width: number; height: number };
export type CropHandle = 'move' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function containedImageRect(stage: ImageSize, image: ImageSize): CropRect {
    if (!stage.width || !stage.height || !image.width || !image.height) {
        return { x: 0, y: 0, width: 0, height: 0 };
    }
    const fit = Math.min(stage.width / image.width, stage.height / image.height);
    const width = image.width * fit;
    const height = image.height * fit;
    return { x: (stage.width - width) / 2, y: (stage.height - height) / 2, width, height };
}

export function dragCropRect(
    start: CropRect,
    handle: CropHandle,
    dx: number,
    dy: number,
    image: ImageSize,
): CropRect {
    if (!image.width || !image.height) return start;
    const deltaX = dx / image.width;
    const deltaY = dy / image.height;
    const minWidth = Math.min(0.9, 88 / image.width);
    const minHeight = Math.min(0.9, 88 / image.height);

    if (handle === 'move') {
        return {
            ...start,
            x: clamp(start.x + deltaX, 0, 1 - start.width),
            y: clamp(start.y + deltaY, 0, 1 - start.height),
        };
    }

    const left = handle.endsWith('Left')
        ? clamp(start.x + deltaX, 0, start.x + start.width - minWidth)
        : start.x;
    const right = handle.endsWith('Right')
        ? clamp(start.x + start.width + deltaX, start.x + minWidth, 1)
        : start.x + start.width;
    const top = handle.startsWith('top')
        ? clamp(start.y + deltaY, 0, start.y + start.height - minHeight)
        : start.y;
    const bottom = handle.startsWith('bottom')
        ? clamp(start.y + start.height + deltaY, start.y + minHeight, 1)
        : start.y + start.height;
    return { x: left, y: top, width: right - left, height: bottom - top };
}

export function cropPixels(crop: CropRect, image: ImageSize) {
    const originX = clamp(Math.round(crop.x * image.width), 0, Math.max(0, image.width - 1));
    const originY = clamp(Math.round(crop.y * image.height), 0, Math.max(0, image.height - 1));
    return {
        originX,
        originY,
        width: clamp(Math.round(crop.width * image.width), 1, image.width - originX),
        height: clamp(Math.round(crop.height * image.height), 1, image.height - originY),
    };
}
