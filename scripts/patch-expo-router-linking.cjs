const fs = require('fs');
const path = require('path');

// Expo Router 57 can resolve Android's initial URL during render and call the
// NavigationContainer state setter before its first commit. Queue that one
// notification until useLinking has mounted. Remove this patch after Expo fixes
// https://github.com/expo/expo/issues/49378.
const linkingPath = path.resolve(
  __dirname,
  '../node_modules/expo-router/build/fork/useLinking.native.js',
);

if (!fs.existsSync(linkingPath)) {
  console.warn('Expo Router linking patch skipped: useLinking.native.js not found.');
  process.exit(0);
}

let source = fs.readFileSync(linkingPath, 'utf8');
const marker = 'const notifyUnhandledLinkingAfterMount =';

if (source.includes(marker)) {
  console.log('Expo Router initial-link patch already applied.');
  process.exit(0);
}

const insertionPoint = '    const getActionFromStateRef = (0, react_1.useRef)(getActionFromState);\n';
const notificationCall =
  'onUnhandledLinking((0, extractPathFromURL_1.extractExpoPathFromURL)(prefixes, url));';
const notificationReplacement =
  'notifyUnhandledLinkingAfterMount((0, extractPathFromURL_1.extractExpoPathFromURL)(prefixes, url));';
const initialStateDependencies = '[getStateFromURL, onUnhandledLinking, prefixes]);';
const insertion = `${insertionPoint}    const linkingMountedRef = (0, react_1.useRef)(false);\n    const pendingUnhandledLinkRef = (0, react_1.useRef)({ hasValue: false, value: undefined });\n    (0, react_1.useEffect)(() => {\n        linkingMountedRef.current = true;\n        if (pendingUnhandledLinkRef.current.hasValue) {\n            onUnhandledLinking(pendingUnhandledLinkRef.current.value);\n            pendingUnhandledLinkRef.current = { hasValue: false, value: undefined };\n        }\n        return () => {\n            linkingMountedRef.current = false;\n        };\n    }, [onUnhandledLinking]);\n    const notifyUnhandledLinkingAfterMount = (0, react_1.useCallback)((path) => {\n        if (linkingMountedRef.current) {\n            onUnhandledLinking(path);\n        }\n        else {\n            pendingUnhandledLinkRef.current = { hasValue: true, value: path };\n        }\n    }, [onUnhandledLinking]);\n`;

if (
  !source.includes(insertionPoint) ||
  source.split(notificationCall).length - 1 < 2 ||
  !source.includes(initialStateDependencies)
) {
  console.warn('Expo Router linking patch skipped: installed source has changed.');
  process.exit(0);
}

source = source.replace(insertionPoint, insertion);
source = source.replace(notificationCall, notificationReplacement);
source = source.replace(notificationCall, notificationReplacement);
source = source.replace(
  initialStateDependencies,
  '[getStateFromURL, notifyUnhandledLinkingAfterMount, prefixes]);',
);

fs.writeFileSync(linkingPath, source, 'utf8');
console.log('Patched Expo Router to defer initial-link notification until mount.');
