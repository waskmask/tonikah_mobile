const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const files = [];
function collect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) collect(fullPath);
        else if (/(Sheet|Drawer|Modal)\.tsx$/.test(entry.name)) files.push(fullPath);
    }
}
collect(path.join(root, 'components'));
const failures = [];
let labels = 0;
for (const file of files) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
        if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === 'Text') {
            labels++;
            // Native display text mirrors with layout direction. Inputs have separate alignment behavior.
            function check(child) {
                if (ts.isPropertyAssignment(child) && child.name.getText(source) === 'textAlign'
                    && ts.isConditionalExpression(child.initializer)
                    && /isRTL/.test(child.initializer.condition.getText(source))) {
                    failures.push(`${path.relative(root, file)}:${source.getLineAndCharacterOfPosition(child.getStart()).line + 1}`);
                }
                ts.forEachChild(child, check);
            }
            check(node.attributes);
        }
        ts.forEachChild(node, visit);
    }
    visit(source);
}
assert.ok(labels > 0, 'Expected overlay Text elements to be audited');
assert.deepEqual(failures, [], 'Overlay Text must not double-mirror textAlign with isRTL');
console.log(`RTL source regression check passed: ${labels} text elements in ${files.length} overlay components.`);
