import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const siteUrl = 'https://imfurman.github.io/varna-local-cup/';
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

// Inject into the built HTML: link-preview crawlers do not need to run the app.
export function socialPreview() {
  return {
    name: 'race-social-preview',
    transformIndexHtml(html, context) {
      const bg = context?.filename?.endsWith('/bg.html') || context?.path?.endsWith('/bg.html');
      const pageUrl = bg ? `${siteUrl}bg.html` : siteUrl;
      const { event, course } = JSON.parse(readFileSync(new URL('../src/generated/race.json', import.meta.url), 'utf8'));
      const date = new Intl.DateTimeFormat(bg ? 'bg-BG' : 'ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(`${event.date}T12:00:00Z`)).replace(/ г\.$/, '');
      const km = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(course.distanceM / 1000);
      const title = `${event.title} · ${date}`;
      const schedule = [event.meeting && `${bg ? 'Среща' : 'Сбор'} в ${event.meeting.time}`, event.startTime && `старт ${event.startApproximate ? 'около ' : 'в '}${event.startTime}`].filter(Boolean).join(', ');
      const description = bg
        ? `Варна, България. ${km} км, изкачване ${Math.round(course.ascentM)} м. ${schedule ? `${schedule} — местно време. ` : ''}Шосе и МТБ, класиране за мъже и жени.`
        : `${event.location}. ${km} км, набор ${Math.round(course.ascentM)} м. ${schedule ? `${schedule} — местное время. ` : ''}Шоссе и МТБ, мужской и женский зачёты.`;
      const coverName = bg ? 'og-bg.png' : 'og.png';
      const cover = readFileSync(new URL(`../public/${coverName}`, import.meta.url));
      if (cover.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('public/og.png должен быть PNG-файлом');
      const imageUrl = `${siteUrl}${coverName}?v=${createHash('sha256').update(cover).digest('hex').slice(0, 12)}`;
      const properties = {
        'og:type': 'website',
        'og:url': pageUrl,
        'og:site_name': event.title,
        'og:locale': bg ? 'bg_BG' : 'ru_RU',
        'og:locale:alternate': bg ? 'ru_RU' : 'bg_BG',
        'og:title': title,
        'og:description': description,
        'og:image': imageUrl,
        'og:image:secure_url': imageUrl,
        'og:image:type': 'image/png',
        'og:image:width': String(cover.readUInt32BE(16)),
        'og:image:height': String(cover.readUInt32BE(20)),
        'og:image:alt': `${bg ? 'Плакат' : 'Афиша'} ${event.title}: ${date}, ${km} км. ${schedule}.`,
      };
      const names = {
        description,
        'twitter:card': 'summary_large_image',
        'twitter:title': title,
        'twitter:description': description,
        'twitter:image': imageUrl,
        'twitter:image:alt': properties['og:image:alt'],
      };
      return {
        html: html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
          .replace(/\s*<meta\s+name="description"[^>]*>/, ''),
        tags: [
          { tag: 'link', attrs: { rel: 'canonical', href: pageUrl }, injectTo: 'head' },
          { tag: 'link', attrs: { rel: 'alternate', hreflang: 'ru', href: siteUrl }, injectTo: 'head' },
          { tag: 'link', attrs: { rel: 'alternate', hreflang: 'bg', href: `${siteUrl}bg.html` }, injectTo: 'head' },
          ...Object.entries(properties).map(([property, content]) => ({ tag: 'meta', attrs: { property, content }, injectTo: 'head' })),
          ...Object.entries(names).map(([name, content]) => ({ tag: 'meta', attrs: { name, content }, injectTo: 'head' })),
        ],
      };
    },
  };
}
