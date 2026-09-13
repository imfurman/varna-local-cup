import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveLanguage, translator } from '../src/lib/i18n.js';
import { socialPreview } from '../scripts/social-preview.mjs';
import bg from '../src/locales/bg.json' with { type: 'json' };

test('shared Bulgarian URL overrides saved Russian; explicit Russian overrides saved Bulgarian', () => {
  assert.equal(resolveLanguage('/varna-local-cup/bg.html', '', 'ru'), 'bg');
  assert.equal(resolveLanguage('/varna-local-cup/', '?lang=ru', 'bg'), 'ru');
  assert.equal(resolveLanguage('/varna-local-cup/', '', 'bg'), 'bg');
  assert.equal(resolveLanguage('/varna-local-cup/', '?lang=unsupported'), 'ru');
  assert.equal(resolveLanguage('/varna-local-cup/'), 'ru');
});

test('Bulgarian translation covers every literal UI key and preserves participant names', () => {
  for (const file of ['src/main.js', 'src/weather.js', 'src/language.js']) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\bt\(("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\)/g)) {
      const key = match[1].startsWith('"') ? JSON.parse(match[1]) : match[1].slice(1, -1);
      assert.ok(Object.hasOwn(bg, key), `Missing translation in ${file}: ${key}`);
      assert.ok(bg[key].length);
    }
  }
  assert.equal(translator('bg')('Дождь'), 'Дъжд');
  assert.equal(translator('ru')('Сбор'), 'Сбор');
  assert.equal(translator('bg')('Andrii Silent'), 'Andrii Silent');
  assert.equal(translator('bg')('Руслан Щур'), 'Руслан Щур');
});

test('each built entry has its own static locale, URL, description and sharing cover', () => {
  const event = JSON.parse(readFileSync('data/event.json', 'utf8'));
  for (const language of ['ru', 'bg']) {
    const file = language === 'bg' ? 'bg.html' : 'index.html';
    const output = socialPreview().transformIndexHtml(readFileSync(file, 'utf8'), { filename: `/site/${file}` });
    const meta = Object.fromEntries(output.tags.filter(t => t.tag === 'meta').map(t => [t.attrs.property || t.attrs.name, t.attrs.content]));
    assert.equal(meta['og:locale'], language === 'bg' ? 'bg_BG' : 'ru_RU');
    assert.ok(meta['og:image'].includes(language === 'bg' ? '/og-bg.png?' : '/og.png?'));
    assert.equal(meta['og:url'], `https://imfurman.github.io/varna-local-cup/${language === 'bg' ? 'bg.html' : ''}`);
    if (event.meeting) assert.ok(meta.description.includes(`${language === 'bg' ? 'Среща' : 'Сбор'} в ${event.meeting.time}`));
    assert.ok(output.tags.some(t => t.attrs.hreflang === 'bg'));
  }
});
