import { imageBubbleTailPath } from './chatBubbleTail';

export type MessageAnchor = { x: number; y: number; width: number; height: number };

export function messageBubbleHolePath(
    bubble: MessageAnchor,
    mine: boolean,
    radius: number,
    options: { tail?: boolean; imageOnly?: boolean; tailWidth?: number } = {},
) {
    const { x, y, width, height } = bubble;
    const tailWidth = options.tailWidth ?? 8;
    if (options.tail) return imageBubbleTailPath(width, height, mine, radius, tailWidth, x, y);
    const bodyX = options.tail && !mine ? x + tailWidth : x;
    const bodyWidth = options.tail ? Math.max(0, width - tailWidth) : width;
    const r = Math.min(radius, bodyWidth / 2, height / 2);
    const bottomLeft = mine || !options.tail ? r : 0;
    const bottomRight = !mine || !options.tail ? r : 0;
    const body = [
        `M ${bodyX + r} ${y}`,
        `H ${bodyX + bodyWidth - r}`,
        `A ${r} ${r} 0 0 1 ${bodyX + bodyWidth} ${y + r}`,
        `V ${y + height - bottomRight}`,
        bottomRight ? `A ${bottomRight} ${bottomRight} 0 0 1 ${bodyX + bodyWidth - bottomRight} ${y + height}` : '',
        `H ${bodyX + bottomLeft}`,
        bottomLeft ? `A ${bottomLeft} ${bottomLeft} 0 0 1 ${bodyX} ${y + height - bottomLeft}` : '',
        `V ${y + r}`,
        `A ${r} ${r} 0 0 1 ${bodyX + r} ${y}`,
        'Z',
    ].filter(Boolean).join(' ');
    return body;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

export function messageContextLayout(
    anchor: MessageAnchor,
    viewport: { width: number; height: number },
    menuHeight: number,
    androidHeaderHeight: number,
    reactionHeight = 48,
    mine = false,
) {
    const edge = 8;
    const gap = 8;
    const menuWidth = Math.min(260, Math.max(0, viewport.width - 32));
    const reactionWidth = Math.min(320, Math.max(0, viewport.width - 32));
    const bubbleX = clamp(anchor.x, 0, viewport.width);
    const bubbleY = clamp(anchor.y, 0, viewport.height);
    const bubble = {
        x: bubbleX,
        y: bubbleY,
        width: Math.max(0, Math.min(anchor.x + anchor.width, viewport.width) - bubbleX),
        height: Math.max(0, Math.min(anchor.y + anchor.height, viewport.height) - bubbleY),
    };
    const reactionX = clamp(mine ? anchor.x + anchor.width - reactionWidth : anchor.x, 16, viewport.width - reactionWidth - 16);
    const reactionYAndroid = clamp(anchor.y - reactionHeight - gap, androidHeaderHeight + edge, viewport.height - reactionHeight - edge);
    const menuX = clamp(mine ? anchor.x + anchor.width - menuWidth : anchor.x, 16, viewport.width - menuWidth - 16);
    const belowY = anchor.y + anchor.height + gap;
    const groupHeight = reactionHeight + gap + menuHeight;
    const fitsBelow = belowY + menuHeight + edge <= viewport.height;
    const fitsAbove = anchor.y - groupHeight >= edge;
    const reactionYIos = fitsBelow
        ? clamp(anchor.y - reactionHeight - gap, edge, viewport.height - reactionHeight - edge)
        : fitsAbove
            ? anchor.y - reactionHeight - gap
            : clamp(anchor.y - reactionHeight - gap, edge, viewport.height - groupHeight - edge);
    const menuY = fitsBelow ? belowY : fitsAbove ? reactionYIos - menuHeight - gap : reactionYIos + reactionHeight + gap;

    return {
        bubble,
        reaction: { x: reactionX, yIos: reactionYIos, yAndroid: reactionYAndroid, width: reactionWidth, height: reactionHeight },
        menu: { x: menuX, y: clamp(menuY, edge, viewport.height - menuHeight - edge), width: menuWidth, height: menuHeight },
    };
}
