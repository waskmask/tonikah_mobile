type Geometry = {
    viewportTop: number;
    viewportHeight: number;
    editorTop: number;
    editorHeight: number;
    scrollOffset: number;
    keyboardTop?: number;
    footerTop?: number;
    gap: number;
};

export function reportEditorVisibility(input: Geometry) {
    const viewportBottom = input.viewportTop + input.viewportHeight;
    const bottom = Math.min(viewportBottom, input.keyboardTop ?? Infinity,
        input.footerTop !== undefined && input.footerTop > input.viewportTop ? input.footerTop : Infinity);
    const top = input.viewportTop + input.gap;
    const availableHeight = Math.max(0, bottom - input.gap - top);
    const editorBottom = input.editorTop + input.editorHeight;
    let delta = 0;
    if (availableHeight > 0) {
        if (input.editorHeight > availableHeight || input.editorTop < top) delta = input.editorTop - top;
        else if (editorBottom > bottom - input.gap) delta = editorBottom - (bottom - input.gap);
    }
    return {
        bottomOverlap: Math.max(0, viewportBottom - bottom),
        scrollOffset: Math.max(0, input.scrollOffset + delta),
    };
}
