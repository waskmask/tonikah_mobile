const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');

const config = require('../app.config')({ config: require('../app.json').expo });
const plugins = config.plugins.filter((entry) => (Array.isArray(entry) ? entry[0] : entry) === 'expo-notifications');

test('notifications use the existing white heart without changing launcher or splash icons', () => {
    assert.equal(plugins.length, 1);
    assert.equal(plugins[0][1].icon, './assets/icon/heart-white.png');
    assert.equal(plugins[0][1].color, '#F34B6F');
    assert.equal(config.icon, './assets/icon/icon.png');
    assert.equal(config.plugins.find((entry) => Array.isArray(entry) && entry[0] === 'expo-splash-screen')[1].image, './assets/icon/heart-white.png');
});

test('heart is a square, transparent, white-only notification silhouette', () => {
    const png = PNG.sync.read(fs.readFileSync(path.resolve(__dirname, '..', plugins[0][1].icon)));
    assert.equal(png.width, png.height);
    let visible = 0;
    let transparent = 0;
    for (let i = 0; i < png.data.length; i += 4) {
        if (png.data[i + 3] === 0) { transparent++; continue; }
        visible++;
        assert.equal(png.data[i], 255);
        assert.equal(png.data[i + 1], 255);
        assert.equal(png.data[i + 2], 255);
    }
    assert.ok(visible > png.width * png.height * 0.1, 'recognizable nonempty symbol');
    assert.ok(transparent > png.width * png.height * 0.4, 'transparent background, not a solid square');
});
