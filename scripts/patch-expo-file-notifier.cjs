const fs = require("fs");
const path = require("path");

const cliEntry = require.resolve("@expo/cli");
const notifierPath = path.resolve(
  path.dirname(cliEntry),
  "../src/utils/FileNotifier.js",
);

const source = fs.readFileSync(notifierPath, "utf8");
const patchedCondition =
  "fileContentsChanged && (prev.size || cur.size)";

if (source.includes(patchedCondition)) {
  console.log("Expo FileNotifier patch already applied.");
  process.exit(0);
}

const original =
  "const listener = (cur, prev)=>{\n            if (prev.size || cur.size) {";
const replacement =
  "const listener = (cur, prev)=>{\n" +
  "            const fileContentsChanged = cur.size !== prev.size || cur.mtimeMs !== prev.mtimeMs;\n" +
  "            if (fileContentsChanged && (prev.size || cur.size)) {";

if (!source.includes(original)) {
  console.warn(
    "Expo FileNotifier patch skipped: installed CLI source has changed.",
  );
  process.exit(0);
}

fs.writeFileSync(notifierPath, source.replace(original, replacement), "utf8");
console.log("Patched Expo FileNotifier to ignore access-time-only changes.");
