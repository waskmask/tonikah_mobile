import assert from 'node:assert/strict';
import { containedImageRect, cropPixels, dragCropRect } from '../lib/chatImageCrop';

function assertCropClose(actual: { x: number; y: number; width: number; height: number }, expected: typeof actual) {
    for (const key of ['x', 'y', 'width', 'height'] as const) {
        assert.ok(Math.abs(actual[key] - expected[key]) < 0.000001, `${key}: ${actual[key]} != ${expected[key]}`);
    }
}

const frame = containedImageRect({ width: 400, height: 600 }, { width: 800, height: 400 });
assert.deepEqual(frame, { x: 0, y: 200, width: 400, height: 200 });

// Crop mode reserves 5% on each side without changing source pixel coordinates.
const insetStage = { width: 400 * 0.9, height: 600 };
const insetFrame = containedImageRect(insetStage, { width: 800, height: 400 });
assert.deepEqual(insetFrame, { x: 0, y: 210, width: 360, height: 180 });
const insetCrop = dragCropRect({ x: 0, y: 0, width: 1, height: 1 }, 'topLeft', 36, 18, insetFrame);
assert.deepEqual(cropPixels(insetCrop, { width: 800, height: 400 }), {
    originX: 80, originY: 40, width: 720, height: 360,
});
assert.deepEqual(containedImageRect(insetStage, { width: 400, height: 800 }), {
    x: 30, y: 0, width: 300, height: 600,
});

const start = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };
assertCropClose(dragCropRect(start, 'move', 200, 100, { width: 400, height: 200 }), {
    x: 0.2, y: 0.2, width: 0.8, height: 0.8,
});
assertCropClose(dragCropRect(start, 'topLeft', 40, 20, { width: 400, height: 200 }), {
    x: 0.2, y: 0.2, width: 0.7, height: 0.7,
});
assertCropClose(dragCropRect(start, 'bottomRight', -40, -20, { width: 400, height: 200 }), {
    x: 0.1, y: 0.1, width: 0.7, height: 0.7,
});
assert.deepEqual(cropPixels(start, { width: 1000, height: 500 }), {
    originX: 100, originY: 50, width: 800, height: 400,
});
assert.deepEqual(cropPixels({ x: 0, y: 0, width: 1, height: 1 }, { width: 500, height: 1000 }), {
    originX: 0, originY: 0, width: 500, height: 1000,
});

console.log('chat image crop geometry tests passed');
