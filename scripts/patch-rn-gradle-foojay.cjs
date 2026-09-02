const fs = require("fs");
const path = require("path");

// @react-native/gradle-plugin pins foojay-resolver-convention 0.5.0, which
// references JvmVendorSpec.IBM_SEMERU — removed in Gradle 9, so every
// `expo run:android` fails with:
//   "Class org.gradle.jvm.toolchain.JvmVendorSpec does not have member field 'IBM_SEMERU'"
// Upstream fix bumps the plugin to 1.0.0 (facebook/react-native#54160).
const settingsPath = path.resolve(
  __dirname,
  "../node_modules/@react-native/gradle-plugin/settings.gradle.kts",
);

if (!fs.existsSync(settingsPath)) {
  console.warn("RN gradle-plugin foojay patch skipped: settings.gradle.kts not found.");
  process.exit(0);
}

const source = fs.readFileSync(settingsPath, "utf8");
const original = 'id("org.gradle.toolchains.foojay-resolver-convention").version("0.5.0")';
const replacement = 'id("org.gradle.toolchains.foojay-resolver-convention").version("1.0.0")';

if (source.includes(replacement)) {
  console.log("RN gradle-plugin foojay patch already applied.");
  process.exit(0);
}

if (!source.includes(original)) {
  console.warn("RN gradle-plugin foojay patch skipped: pinned version has changed upstream.");
  process.exit(0);
}

fs.writeFileSync(settingsPath, source.replace(original, replacement), "utf8");
console.log("Patched @react-native/gradle-plugin foojay-resolver-convention 0.5.0 -> 1.0.0.");
