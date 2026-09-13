import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@fontsource-variable/manrope';
import '@fontsource/oswald/600.css';
import './style.css';
import race from './generated/race.json';
import { categories, formatTime, leaderboard } from './lib/race.js';
import { meetingTimestamp, countdownParts } from './lib/countdown.js';
import { startWeather } from './weather.js';

const { event, participants, results, course } = race;
const number = (value, digits = 0) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const icon = (name, size = 20) => {
  const paths = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5"/>',
    mountain: '<path d="m2 20 8-15 5 9 3-5 4 11H2Zm5-9 3 2 3-2"/>',
    flag: '<path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
    fit: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    bike: '<circle cx="5.5" cy="16" r="4.5"/><circle cx="18.5" cy="16" r="4.5"/><path d="m5.5 16 5-10 8 10M8 6h6m1-4h4"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
};
const date = new Date(`${event.date}T12:00:00Z`);
const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const month = dateFormat.formatToParts(date).find(part => part.type === 'month').value;
const longDate = dateFormat.format(date).replace(/ г\.$/, '');
const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', timeZone: 'UTC' }).format(date);
const status = { upcoming: 'Готовимся к старту', results: 'Принимаем результаты', finished: 'Заезд завершён' }[event.status];
const startLabel = event.startTime ? `${event.startApproximate ? '≈ ' : ''}${event.startTime}` : 'Время уточняется';
const meetingCoordinates = event.meeting ? `${number(Math.abs(event.meeting.lat), 5)}° ${event.meeting.lat >= 0 ? 'С' : 'Ю'}, ${number(Math.abs(event.meeting.lon), 5)}° ${event.meeting.lon >= 0 ? 'В' : 'З'}` : '';
const meetingMapsUrl = event.meeting ? `https://www.google.com/maps/search/?api=1&query=${event.meeting.lat}%2C${event.meeting.lon}` : '';
const meetingAt = meetingTimestamp(event);
document.title = `${event.title} · ${longDate}`;

document.querySelector('#app').innerHTML = `
  <header class="site-header">
    <a class="brand" href="#" aria-label="${escape(event.title)} — начало">VLC<span class="brand-slash">/</span></a>
    <nav aria-label="Основная навигация"><a href="#route" class="active">Маршрут</a><a href="#participants">Участники <span class="nav-count">${String(participants.length).padStart(2, '0')}</span></a><a href="#results">Результаты</a></nav>
    <span class="header-edition">Варна<span>Заезд ${escape(event.edition)}</span></span>
  </header>
  <main>
    <div class="weather-strip" aria-label="Текущая погода в Варне"><div class="weather-reading"><span class="weather-location">Варна сейчас</span><span id="weather-summary" role="status">Загружаем погоду…</span><span id="weather-detail"></span></div><div class="weather-actions"><button id="weather-motion" type="button" aria-pressed="false" hidden>Выключить анимацию</button><a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" aria-label="Источник погоды — Open-Meteo">Open-Meteo</a></div></div>
    <section class="event-heading" aria-labelledby="event-title">
      <div class="event-name"><p class="eyebrow">Локальная велогонка <span>Шоссе / МТБ</span></p><h1 id="event-title">${escape(event.title)}</h1></div>
      <div class="event-date"><strong class="date-day">${String(date.getUTCDate()).padStart(2, '0')}.${String(date.getUTCMonth()+1).padStart(2, '0')}<span>/${date.getUTCFullYear()}</span></strong><p>${escape(weekday)}<br>${event.meeting ? `Сбор <b>${escape(event.meeting.time)}</b> · ` : ''}Старт <b>${escape(startLabel)}</b></p></div>
    </section>
    ${meetingAt !== null ? `<section class="meeting-countdown" aria-label="Обратный отсчёт до сбора"><div class="countdown-caption"><span id="countdown-label">До сбора</span><p>${date.getUTCDate()} ${escape(month)} · ${escape(event.meeting.time)} · время Варны</p></div><div id="countdown-digits" class="countdown-digits" role="timer" aria-live="off">${[['days', 'дни'], ['hours', 'часы'], ['minutes', 'минуты'], ['seconds', 'секунды']].map(([key, label]) => `<div><strong data-countdown="${key}">00</strong><span>${label}</span></div>`).join('')}</div><p id="countdown-started" class="countdown-started" hidden>Увидимся на точке сбора!</p><span id="countdown-announcement" class="sr-only" role="status"></span></section>` : ''}
    <section id="route" class="route-section" aria-labelledby="route-title">
      <div class="section-heading"><h2 id="route-title">Маршрут</h2><span class="section-note">${escape(event.location)} <span class="note-divider">/</span> ${status}</span></div>
      <div class="route-grid">
        <div class="course-card">
          <div class="map-wrap"><div id="map" aria-label="Карта маршрута: старт и финиш, отметки километров"></div><div class="map-label">${number(course.distanceM / 1000, 2)} КМ <span>GPX</span></div><button id="fit-map" class="map-fit" aria-label="Показать весь маршрут" title="Показать весь маршрут">${icon('fit')}</button><p class="map-error" hidden>Подложка карты недоступна. Трек маршрута показан; GPX можно скачать.</p></div>
          <div class="elevation"><div class="elevation-heading"><h3>Профиль высот</h3><span id="profile-readout">${number(course.minElevationM)}–${number(course.maxElevationM)} м</span></div><div id="profile"></div><div class="elevation-footer"><span>Расстояние, км</span><span>Высоты по GPX</span></div></div>
          <div class="route-endpoints"><span><b>Старт</b> ${course.points[0].lat.toFixed(5)}, ${course.points[0].lon.toFixed(5)}</span><span><b>Финиш</b> ${course.points.at(-1).lat.toFixed(5)}, ${course.points.at(-1).lon.toFixed(5)}</span></div>
        </div>
        <aside class="route-aside" aria-label="Параметры маршрута и старт">
          <div class="distance-card"><span class="small-label">Дистанция</span><div class="distance-value">${number(course.distanceM / 1000, 2)}<span>км</span></div><div class="terrain-stats"><div><strong>${number(course.ascentM)} <small>м</small></strong><span>Набор высоты</span></div><div><strong>${number(course.descentM)} <small>м</small></strong><span>Спуск</span></div></div><a href="./${escape(event.routeFile)}" download class="download-button">Скачать GPX ${icon('download', 19)}</a></div>
          <div class="start-card"><h3>Встречаемся ${date.getUTCDate()} ${escape(month)}</h3>
            <dl class="event-schedule">${event.meeting ? `<div><dt>Сбор</dt><dd>${escape(event.meeting.time)}</dd></div>` : ''}<div><dt>Старт${event.startApproximate ? '<small>ориентировочно</small>' : ''}</dt><dd>${escape(startLabel)}</dd></div></dl>
            <p class="local-time">Местное время · ${escape(event.timezone)}</p>
            ${event.meeting ? `<div class="meeting-point"><h4>Точка сбора</h4><p>${meetingCoordinates}</p><button id="show-meeting" type="button">Показать на карте ${icon('fit', 16)}</button><a href="${meetingMapsUrl}" target="_blank" rel="noopener noreferrer">Открыть в картах ${icon('arrow', 16)}</a></div>` : ''}
          </div>
        </aside>
      </div>
    </section>
    <section id="participants" class="participants-section" aria-labelledby="participants-title">
      <div class="participants-heading"><span class="small-label">Заезд ${escape(event.edition)} / ${date.getUTCFullYear()}</span><h2 id="participants-title">Стартовый<br>список<span class="participant-total">${String(participants.length).padStart(2, '0')}</span></h2><p>Шоссе и МТБ вместе.<br>Мужской и женский зачёты.</p></div>
      <div class="rider-grid">${participants.length ? participants.map(rider => {
        const finished = results.some(r => r.riderId === rider.id);
        return `<article class="rider-row"><span class="bib">${String(rider.bib).padStart(2, '0')}</span><h3>${escape(rider.name)}</h3><span class="rider-category">${categories[rider.gender]}</span><span class="rider-status">${finished ? 'Результат принят' : event.status === 'upcoming' ? 'На старте' : 'Ожидаем запись'}</span></article>`;
      }).join('') : '<p class="empty-riders">Стартовый список скоро появится.</p>'}</div>
    </section>
    <section id="results" class="results-section" aria-labelledby="results-title">
      <div class="section-heading"><h2 id="results-title">Результаты<span class="count-badge">${String(results.length).padStart(2, '0')}</span></h2><span class="section-note">Полное время, включая остановки</span></div>
      <div class="results-card"><div class="results-toolbar"><div class="filters" role="group" aria-label="Зачёт"><button data-filter="all" class="selected" aria-pressed="true">Все</button><button data-filter="male" aria-pressed="false">Мужчины</button><button data-filter="female" aria-pressed="false">Женщины</button></div><span class="verified-note">После проверки организатором</span></div><div id="leaderboard" aria-live="polite"></div></div>
      <p class="results-footnote">Места — отдельно среди мужчин и женщин. При равном времени — одинаковое место.</p>
    </section>
    <section id="rules" class="rules-section" aria-labelledby="rules-title"><h2 id="rules-title">Порядок заезда</h2><div class="rules-grid"><article><h3>Запись</h3><p>Запустите запись с GPS до старта и завершите после финиша. Маршрут одинаковый для шоссе и МТБ.</p></article><article><h3>Проверка</h3><p>Передайте оригинальный FIT-файл организатору. Он сверит трек и время прохождения.</p></article><article><h3>Зачёт</h3><p>Считаем время от старта до финиша с остановками. Победители — отдельно среди мужчин и женщин.</p></article></div></section>
  </main>
  <footer><a class="footer-brand" href="#">${escape(event.title)}<span>/</span></a><span>Варна · ${date.getUTCFullYear()}</span><a href="./${escape(event.routeFile)}" download>Маршрут GPX ${icon('download', 16)}</a></footer>
  <dialog id="result-dialog"><div class="dialog-heading"><h2 id="result-name">Результат</h2><button id="close-dialog" class="icon-button" aria-label="Закрыть">${icon('close')}</button></div><div id="result-detail"></div></dialog>`;

if (meetingAt !== null) {
  const digits = document.querySelector('#countdown-digits');
  const fields = [...digits.querySelectorAll('[data-countdown]')];
  let timer;
  const updateCountdown = () => {
    const remaining = countdownParts(meetingAt);
    for (const field of fields) field.textContent = String(remaining[field.dataset.countdown]).padStart(2, '0');
    if (remaining.started) {
      document.querySelector('#countdown-label').textContent = 'Сбор уже начался';
      digits.hidden = true;
      document.querySelector('#countdown-started').hidden = false;
      document.querySelector('#countdown-announcement').textContent = 'Сбор уже начался';
      clearInterval(timer);
    }
  };
  timer = setInterval(updateCountdown, 1000);
  updateCountdown();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateCountdown(); });
}

startWeather();

const map = L.map('map', { scrollWheelZoom: false, zoomControl: false, zoomSnap: 0.25 });
L.control.zoom({ position: 'topright' }).addTo(map);
const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);
tiles.on('tileerror', () => { document.querySelector('.map-error').hidden = false; });
const coords = course.points.map(p => [p.lat, p.lon]);
L.polyline(coords, { color: '#713c24', weight: 10, opacity: 0.18, interactive: false }).addTo(map);
L.polyline(coords, { color: '#fffdf5', weight: 8, opacity: 1, interactive: false }).addTo(map);
const routeLine = L.polyline(coords, { color: '#f04428', weight: 4.5, opacity: 1 }).addTo(map);
const fitMap = () => map.fitBounds(routeLine.getBounds(), { paddingTopLeft: [65, 65], paddingBottomRight: [65, 45] });
fitMap();
document.querySelector('#fit-map').addEventListener('click', fitMap);
const markerIcon = (text, type, below = false) => L.divIcon({ className: 'route-marker', html: `<span class="${type}">${text}</span>`, iconSize: [32, 32], iconAnchor: [16, below ? -8 : 16] });
const endpointIcon = (text, type) => L.divIcon({
  className: `endpoint-marker ${type}`,
  html: `<span class="endpoint-badge"><i aria-hidden="true"></i>${text}</span><span class="endpoint-dot"></span>`,
  iconSize: [90, 48], iconAnchor: [45, 48], popupAnchor: [0, -44],
});
L.marker(coords[0], { icon: endpointIcon('Старт', 'marker-start'), title: 'Старт', zIndexOffset: 200 }).addTo(map).bindPopup('Старт маршрута');
L.marker(coords.at(-1), { icon: endpointIcon('Финиш', 'marker-finish'), title: 'Финиш', zIndexOffset: 200 }).addTo(map).bindPopup('Финиш маршрута');
if (event.meeting) {
  const meetingMarker = L.circleMarker([event.meeting.lat, event.meeting.lon], { color: '#fff', fillColor: '#138bce', fillOpacity: 1, weight: 3, radius: 7 })
    .addTo(map)
    .bindTooltip(`Сбор · ${escape(event.meeting.time)}`, { permanent: true, direction: 'right', offset: [12, 0], className: 'meeting-tooltip' })
    .bindPopup(`<strong>Точка сбора · ${escape(event.meeting.time)}</strong><br>${meetingCoordinates}<br>Старт заезда ${escape(startLabel)}${event.startApproximate ? ' (ориентировочно)' : ''}`);
  document.querySelector('#show-meeting').addEventListener('click', () => {
    const container = map.getContainer();
    container.scrollIntoView({ block: 'center', behavior: 'instant' });
    container.tabIndex = 0;
    container.focus({ preventScroll: true });
    map.setView(meetingMarker.getLatLng(), 18);
    meetingMarker.openPopup();
  });
}
for (let km = 10; km < course.distanceM / 1000; km += 10) {
  const p = course.points.find(p => p.distanceM >= km * 1000);
  L.marker([p.lat, p.lon], { icon: markerIcon(km, 'marker-km', course.distanceM - p.distanceM < 1000), title: `${km} км` }).addTo(map).bindPopup(`${km} км`);
}
new ResizeObserver(() => map.invalidateSize()).observe(document.querySelector('#map'));

const width = 900, height = 142, top = 14, bottom = 112;
const maxElevation = Math.ceil(course.maxElevationM / 100) * 100;
const xFor = p => 34 + p.distanceM / course.distanceM * (width - 48);
const yFor = p => bottom - p.ele / maxElevation * (bottom - top);
const profilePath = course.points.map((p, i) => `${i ? 'L' : 'M'}${xFor(p).toFixed(2)},${yFor(p).toFixed(2)}`).join(' ');
document.querySelector('#profile').innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Профиль маршрута: ${number(course.distanceM / 1000, 2)} км, набор ${number(course.ascentM)} метров"><defs><linearGradient id="elevation-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e33b24" stop-opacity=".24"/><stop offset="1" stop-color="#e33b24" stop-opacity=".03"/></linearGradient></defs>${[0, 200, 400].filter(n => n <= maxElevation).map(n => `<line x1="34" x2="886" y1="${yFor({ ele: n })}" y2="${yFor({ ele: n })}" stroke="#dedede" stroke-dasharray="3 5"/><text x="0" y="${yFor({ ele: n }) + 4}" class="chart-label">${n}</text>`).join('')}<path d="${profilePath} L886,${bottom} L34,${bottom}Z" fill="url(#elevation-fill)"/><path d="${profilePath}" stroke="#e33b24" fill="none" stroke-width="2"/>${[0, 10, 20, 30, 40].filter(km => km * 1000 < course.distanceM).map(km => `<text x="${xFor({ distanceM: km * 1000 })}" y="137" text-anchor="middle" class="chart-label">${km}</text>`).join('')}<line id="profile-cursor" y1="10" y2="112" stroke="#181818" stroke-dasharray="3 3" visibility="hidden"/></svg><input id="profile-position" class="sr-only" type="range" min="0" max="${course.points.length - 1}" value="0" aria-label="Исследовать высоты маршрута, используйте стрелки" />`;
let profileMarker;
function showProfilePoint(index) {
  const p = course.points[index];
  document.querySelector('#profile-readout').textContent = `${number(p.distanceM / 1000, 1)} км · ${number(p.ele)} м`;
  const cursor = document.querySelector('#profile-cursor');
  cursor.setAttribute('x1', xFor(p)); cursor.setAttribute('x2', xFor(p)); cursor.setAttribute('visibility', 'visible');
  if (!profileMarker) profileMarker = L.circleMarker([p.lat, p.lon], { color: '#242921', fillColor: '#fff', fillOpacity: 1, radius: 5, weight: 2 }).addTo(map);
  else profileMarker.setLatLng([p.lat, p.lon]);
  document.querySelector('#profile-position').setAttribute('aria-valuetext', `${number(p.distanceM / 1000, 1)} км, ${number(p.ele)} метров`);
}
document.querySelector('#profile svg').addEventListener('pointermove', e => {
  const bounds = e.currentTarget.getBoundingClientRect();
  const target = Math.max(0, Math.min(1, ((e.clientX - bounds.left) / bounds.width * width - 34) / (width - 48))) * course.distanceM;
  const index = course.points.findIndex(p => p.distanceM >= target);
  showProfilePoint(index < 0 ? course.points.length - 1 : index);
});
document.querySelector('#profile-position').addEventListener('input', e => showProfilePoint(Number(e.target.value)));

function renderResults(filter = 'all') {
  const rows = leaderboard(participants, results, filter);
  const body = document.querySelector('#leaderboard');
  if (!rows.length) {
    body.innerHTML = `<div class="empty-results"><span class="empty-timing" aria-hidden="true">—:—:—</span><div><h3>${results.length ? 'Пока нет результатов в этом зачёте' : event.status === 'upcoming' ? 'Сначала — заезд.' : 'Ждём записи заезда.'}</h3><p>${results.length ? 'Результаты появятся после проверки записей.' : event.status === 'upcoming' ? `${escape(longDate)}. Время и места появятся после проверки FIT-файлов.` : 'Организатор проверит FIT-файлы и опубликует время участников.'}</p></div></div>`;
    return;
  }
  body.innerHTML = `<div class="table-scroll"><table><caption class="sr-only">${filter === 'all' ? 'Все результаты, порядок по времени' : categories[filter]}</caption><thead><tr><th>${filter === 'all' ? 'Порядок' : 'Место'}</th><th>Участник</th><th>Время</th><th>Отставание</th><th>Ср. скорость</th><th><span class="sr-only">Подробности</span></th></tr></thead><tbody>${rows.map(row => `<tr><td><span class="rank ${row.rank <= 3 ? 'top-rank' : ''}">${row.rank}</span></td><td><strong>${escape(row.rider.name)}</strong><span class="table-sub">№ ${String(row.rider.bib).padStart(2, '0')} · ${categories[row.rider.gender]}</span></td><td class="time-cell">${formatTime(row.elapsedSeconds)}</td><td class="gap-cell">${row.gap ? `+${formatTime(row.gap)}` : '—'}</td><td>${number(course.distanceM / row.elapsedSeconds * 3.6, 1)} <small>км/ч</small></td><td><button class="result-open" data-rider="${escape(row.riderId)}" aria-label="Результат ${escape(row.rider.name)}">${icon('arrow')}</button></td></tr>`).join('')}</tbody></table></div>`;
  body.querySelectorAll('.result-open').forEach(button => button.addEventListener('click', () => openResult(button.dataset.rider)));
}
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); });
  renderResults(button.dataset.filter);
}));
renderResults();

let resultMap;
function openResult(id) {
  const result = results.find(r => r.riderId === id);
  const rider = participants.find(r => r.id === id);
  document.querySelector('#result-name').textContent = rider.name;
  document.querySelector('#result-detail').innerHTML = `<div class="detail-metrics"><div><span>Полное время</span><strong>${formatTime(result.elapsedSeconds)}</strong></div><div><span>Ср. скорость по маршруту</span><strong>${number(course.distanceM / result.elapsedSeconds * 3.6, 1)} <small>км/ч</small></strong></div></div><div id="result-map" aria-label="Сравнение GPX маршрута и записи участника"></div><p class="detail-key"><span>Красный — маршрут</span><span>Синий — запись участника</span></p><p>${escape(result.note || 'Маршрут и время проверены организатором.')}</p><p class="detail-note">Оценка времени по GPS с точностью до секунды. Остановки включены. Запись показана только между стартом и финишем.</p>`;
  document.querySelector('#result-dialog').showModal();
  resultMap = L.map('result-map', { scrollWheelZoom: false });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(resultMap);
  L.polyline(coords, { color: '#e33b24', weight: 5 }).addTo(resultMap);
  const trace = L.polyline(result.trace.map(p => [p.lat, p.lon]), { color: '#337db6', weight: 3 }).addTo(resultMap);
  resultMap.fitBounds(routeLine.getBounds().extend(trace.getBounds()), { padding: [25, 25] });
}
const dialog = document.querySelector('#result-dialog');
dialog.setAttribute('aria-labelledby', 'result-name');
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { resultMap?.remove(); resultMap = null; });
dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
const observer = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) document.querySelectorAll('nav a').forEach(link => link.classList.toggle('active', link.hash === `#${entry.target.id}`));
}), { rootMargin: '-15% 0px -65% 0px' });
['route', 'participants', 'results'].forEach(id => observer.observe(document.getElementById(id)));
