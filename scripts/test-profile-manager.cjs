const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { createInstance } = require('i18next');
const { Trans } = require('react-i18next');

async function main() {
    for (const language of ['en', 'ar', 'de', 'es', 'fr', 'id', 'it', 'pl', 'pt', 'ru', 'tr']) {
        const common = JSON.parse(fs.readFileSync(path.join(__dirname, `../locales/${language}/common.json`), 'utf8'));
        const i18n = createInstance();
        await i18n.init({ lng: language, resources: { [language]: { common } }, defaultNS: 'common' });
        for (const relation of ['father', 'mother', 'brother', 'sister', 'relative', 'friend', 'other']) {
            const key = `profile_manager_messages.${relation}`;
            assert.ok(common.profile_manager_messages[relation].includes('<name/>'), `${language}: ${key}`);
            const html = renderToStaticMarkup(React.createElement(Trans, {
                i18n, ns: 'common', i18nKey: key,
                components: { name: React.createElement('strong', null, 'Ahmed <test>') },
            }));
            assert.ok(html.includes('<strong>Ahmed &lt;test&gt;</strong>'), `${language}: bold escaped name`);
            assert.ok(!html.includes('<name'), `${language}: unrendered name tag`);
            assert.ok(!html.includes('profile_manager_messages'), `${language}: missing translation`);
        }
    }
    console.log('Profile manager: all 7 relationships render translated, bold names safely in all 11 languages.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
