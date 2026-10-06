import assert from 'node:assert/strict';
import { reportEditorVisibility } from '../lib/reportEditorVisibility';

const base = { viewportTop: 100, viewportHeight: 700, editorTop: 590, editorHeight: 110, scrollOffset: 0, gap: 12 };
assert.deepEqual(reportEditorVisibility({ ...base, keyboardTop: 500, footerTop: 440 }), { bottomOverlap: 360, scrollOffset: 272 });
// An already-resized Android viewport must not subtract the keyboard height again.
assert.deepEqual(reportEditorVisibility({ ...base, viewportHeight: 340, keyboardTop: 500, footerTop: 440 }), { bottomOverlap: 0, scrollOffset: 272 });
// No extra movement when focus is already visible or the keyboard is closed.
assert.equal(reportEditorVisibility({ ...base, editorTop: 150 }).scrollOffset, 0);
assert.equal(reportEditorVisibility({ ...base, editorTop: 150, keyboardTop: 500, footerTop: 440, scrollOffset: 270 }).scrollOffset, 270);
// Long descriptions align their top when the entire editor cannot fit.
assert.equal(reportEditorVisibility({ ...base, editorHeight: 600, keyboardTop: 500 }).scrollOffset, 478);
assert.equal(reportEditorVisibility({ ...base, editorTop: 80, scrollOffset: 100 }).scrollOffset, 68);
assert.equal(reportEditorVisibility({ ...base, editorTop: 80 }).scrollOffset, 0);
// Ignore an unmeasured footer, and avoid scrolling against a collapsed viewport.
assert.equal(reportEditorVisibility({ ...base, footerTop: 0 }).bottomOverlap, 0);
assert.equal(reportEditorVisibility({ ...base, viewportHeight: 0 }).scrollOffset, 0);
console.log('Report editor visibility: 9 checks passed.');
