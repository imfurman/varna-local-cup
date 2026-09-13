import { resolveLanguage, translator } from './lib/i18n.js';

let saved;
try { saved = localStorage.getItem('vlc-language'); } catch { /* Optional preference. */ }
export const language = resolveLanguage(location.pathname, location.search, saved);
export const locale = language === 'bg' ? 'bg-BG' : 'ru-RU';
export const t = translator(language);
try { localStorage.setItem('vlc-language', language); } catch { /* Links still work. */ }
document.documentElement.lang = language;
if ((language === 'bg') !== location.pathname.endsWith('/bg.html')) {
  const target = new URL(language === 'bg' ? './bg.html' : './?lang=ru', location.href);
  target.hash = location.hash;
  location.replace(target);
}
document.querySelector('.skip-link').textContent = t('К маршруту');
