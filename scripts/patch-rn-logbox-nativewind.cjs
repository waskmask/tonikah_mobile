const fs = require('fs');
const path = require('path');

// React Native 0.86 changed LogBoxButton to a Pressable with a function-valued
// style. NativeWind 4's JSX interop currently breaks that internal style and
// leaves LogBox white/blank. Keep this development-only patch until the
// upstream incompatibility is resolved:
// https://github.com/nativewind/nativewind/issues/1834
const logBoxButtonPath = path.resolve(
  __dirname,
  '../node_modules/react-native/Libraries/LogBox/UI/LogBoxButton.js',
);

if (!fs.existsSync(logBoxButtonPath)) {
  console.warn('React Native LogBox patch skipped: LogBoxButton.js not found.');
  process.exit(0);
}

let source = fs.readFileSync(logBoxButtonPath, 'utf8');
const marker = 'Patched for NativeWind compatibility: static Pressable style.';

if (source.includes(marker)) {
  console.log('React Native LogBox NativeWind patch already applied.');
  process.exit(0);
}

const original = `      style={({pressed}) =>
        StyleSheet.compose(
          {
            backgroundColor: pressed
              ? resolvedBackgroundColor.pressed
              : resolvedBackgroundColor.default,
          },
          focused ? StyleSheet.compose(style, styles.focusRing) : style,
        )
      }>`;
const replacement = `      style={
        /* ${marker} */
        StyleSheet.compose(
          {backgroundColor: resolvedBackgroundColor.default},
          focused ? StyleSheet.compose(style, styles.focusRing) : style,
        )
      }>`;

if (!source.includes(original)) {
  console.warn('React Native LogBox patch skipped: installed source has changed.');
  process.exit(0);
}

source = source.replace(original, replacement);
fs.writeFileSync(logBoxButtonPath, source, 'utf8');
console.log('Patched React Native LogBox for NativeWind compatibility.');
