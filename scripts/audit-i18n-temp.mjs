import fs from "fs";
import path from "path";

const root = process.cwd();

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory() && !["node_modules", "locales", "scripts"].includes(f)) walk(p, out);
    else if (/\.(tsx|ts)$/.test(f)) out.push(p);
  }
  return out;
}

function readJson(p) {
  const raw = fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "");
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function flat(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flat(v, key));
    else out[key] = v;
  }
  return out;
}

const namespaces = ["common", "chat", "countries", "nationalities", "designations", "ethnic_group", "ethnic_groups", "languages"];
const langs = fs.readdirSync(path.join(root, "locales")).filter((d) => fs.statSync(path.join(root, "locales", d)).isDirectory());

const enByNs = {};
for (const ns of namespaces) {
  const p = path.join(root, "locales", "en", `${ns}.json`);
  if (fs.existsSync(p)) enByNs[ns] = flat(readJson(p));
}

const used = new Set();
const reList = [
  /\bt\(\s*['"]([^'"]+)['"]/g,
  /\btr\(\s*['"]([^'"]+)['"]/g,
  /translated\(\s*t,\s*['"]([^'"]+)['"]/g,
  /i18n\.t\(\s*['"]([^'"]+)['"]/g,
];

for (const file of walk(root)) {
  const src = fs.readFileSync(file, "utf8");
  for (const re of reList) {
    let m;
    while ((m = re.exec(src))) used.add(m[1]);
  }
}

function resolveKey(key) {
  if (key.includes(":")) {
    const [ns, rest] = key.split(":");
    const flatNs = enByNs[ns];
    return flatNs && rest in flatNs;
  }
  return key in enByNs.common;
}

const missingInEn = [...used].filter((k) => !resolveKey(k)).sort();

console.log("=== USED KEYS", used.size);
console.log("=== MISSING IN EN", missingInEn.length);
missingInEn.forEach((k) => console.log(k));

console.log("\n=== ALL NAMESPACES PARITY vs en");
for (const ns of namespaces) {
  const enKeys = Object.keys(enByNs[ns] || {});
  console.log(`\n--- ${ns}.json (${enKeys.length} en keys) ---`);
  for (const lang of langs.filter((l) => l !== "en")) {
    const p = path.join(root, "locales", lang, `${ns}.json`);
    if (!fs.existsSync(p)) {
      console.log(`${lang}: FILE MISSING`);
      continue;
    }
    const lf = flat(readJson(p));
    const missing = enKeys.filter((k) => !(k in lf));
    const extra = Object.keys(lf).filter((k) => !(k in enByNs[ns]));
    console.log(`${lang}: missing ${missing.length}, extra ${extra.length}`);
    if (missing.length > 0 && missing.length <= 30) {
      missing.forEach((k) => console.log(`  - ${k}`));
    } else if (missing.length > 30) {
      missing.slice(0, 15).forEach((k) => console.log(`  - ${k}`));
      console.log(`  ... and ${missing.length - 15} more`);
    }
  }
}

console.log("\n=== COMMON.JSON TOP MISSING KEY PREFIXES (ar sample)");
const arCommon = flat(readJson(path.join(root, "locales/ar/common.json")));
const enCommonKeys = Object.keys(enByNs.common);
const arMissing = enCommonKeys.filter((k) => !(k in arCommon));
const prefixCount = {};
for (const k of arMissing) {
  const p = k.split(".")[0];
  prefixCount[p] = (prefixCount[p] || 0) + 1;
}
Object.entries(prefixCount)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .forEach(([p, c]) => console.log(`${p}: ${c}`));
