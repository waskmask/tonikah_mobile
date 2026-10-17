const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { AndroidConfig } = require("@expo/config-plugins");
const config = require("../app.json").expo;

async function main() {
    const root = path.resolve(__dirname, "..");
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tonikah-native-locales-"));
    try {
        const locales = {};
        for (const [language, file] of Object.entries(config.locales)) {
            const native = JSON.parse(await fs.readFile(path.resolve(root, file), "utf8"));
            assert.deepEqual(Object.keys(native).sort(), ["android", "ios"], `${language}: native metadata only`);
            for (const platform of ["android", "ios"]) {
                for (const [key, value] of Object.entries(native[platform])) {
                    assert.equal(typeof value, "string", `${language}.${platform}.${key}`);
                }
            }
            const common = JSON.parse(await fs.readFile(path.join(root, "locales", language, "common.json"), "utf8"));
            assert.equal(typeof common.verifications_page.title, "string", `${language}: screen translations retained`);
            locales[language] = native;
        }
        await fs.mkdir(path.join(temporaryRoot, "android", "app", "src", "main", "res"), { recursive: true });
        await AndroidConfig.Locales.setLocalesAsync({ ...config, locales }, { projectRoot: temporaryRoot });
        for (const language of Object.keys(locales)) {
            const xml = await fs.readFile(path.join(temporaryRoot, "android", "app", "src", "main", "res", `values-b+${language}`, "strings.xml"), "utf8");
            assert.ok(xml.includes('name="app_name"'));
            assert.ok(!xml.includes("[object Object]"));
            assert.ok(!xml.includes("verifications_page"));
        }
        console.log(`Native locale resource generation passed for ${Object.keys(locales).length} languages.`);
    } finally {
        await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
