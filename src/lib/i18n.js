import bg from '../locales/bg.json' with { type: 'json' };

export function resolveLanguage(pathname, search = '', saved = null) {
  const explicit = new URLSearchParams(search).get('lang');
  if (explicit === 'ru' || explicit === 'bg') return explicit;
  if (pathname.endsWith('/bg.html')) return 'bg';
  return saved === 'bg' ? 'bg' : 'ru';
}

export function translator(language) {
  return message => language === 'bg' ? bg[message] ?? message : message;
}
