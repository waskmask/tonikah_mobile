export function imageBubbleTailPath(
    width: number,
    height: number,
    mine: boolean,
    radius = 14,
    tailWidth = 8,
    x = 0,
    y = 0,
) {
    const w = Math.max(0, width);
    const h = Math.max(0, height);
    const t = Math.min(tailWidth, w / 4);
    const r = Math.min(radius, (w - t) / 2, h / 2);
    const tailHeight = Math.min(t * 1.5, h / 3);

    if (mine) {
        const bodyRight = x + w - t;
        return [
            `M ${x + r} ${y}`,
            `H ${bodyRight - r}`,
            `A ${r} ${r} 0 0 1 ${bodyRight} ${y + r}`,
            `V ${y + h - tailHeight}`,
            `Q ${bodyRight} ${y + h - tailHeight / 3} ${x + w} ${y + h - t / 4}`,
            `Q ${bodyRight + t / 2} ${y + h} ${bodyRight - t / 2} ${y + h}`,
            `H ${x + r}`,
            `A ${r} ${r} 0 0 1 ${x} ${y + h - r}`,
            `V ${y + r}`,
            `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
            'Z',
        ].join(' ');
    }

    const bodyLeft = x + t;
    return [
        `M ${bodyLeft + r} ${y}`,
        `H ${x + w - r}`,
        `A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
        `V ${y + h - r}`,
        `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
        `H ${bodyLeft + t / 2}`,
        `Q ${bodyLeft - t / 2} ${y + h} ${x} ${y + h - t / 4}`,
        `Q ${bodyLeft} ${y + h - tailHeight / 3} ${bodyLeft} ${y + h - tailHeight}`,
        `V ${y + r}`,
        `A ${r} ${r} 0 0 1 ${bodyLeft + r} ${y}`,
        'Z',
    ].join(' ');
}

export function coloredBubbleTailPath(mine: boolean, width = 8, height = 12, x = 0, y = 0) {
    return mine
        ? `M ${x} ${y} C ${x + 1} ${y + height - 5} ${x + width - 4} ${y + height - 2} ${x + width} ${y + height} H ${x} Z`
        : `M ${x + width} ${y} C ${x + width - 1} ${y + height - 5} ${x + 4} ${y + height - 2} ${x} ${y + height} H ${x + width} Z`;
}
