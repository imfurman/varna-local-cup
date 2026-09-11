import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@fontsource-variable/manrope';
import '@fontsource/oswald/600.css';
import './style.css';
import race from './generated/race.json';
import { categories, formatTime, leaderboard } from './lib/race.js';

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
document.title = `${event.title} · ${longDate}`;

document.querySelector('#app').innerHTML = `
  <header class="site-header"><a class="brand" href="#" aria-label="${escape(event.title)} — начало"><span class="brand-icon">${icon('bike', 29)}</span><span>VARNA<span class="brand-light">LOCAL CUP</span></span></a>
    <nav aria-label="Основная навигация"><a href="#route" class="active">Маршрут</a><a href="#participants">Участники <span class="nav-count">${participants.length}</span></a><a href="#results">Результаты</a></nav>
    <span class="header-edition">ЛОКАЛЬНАЯ ГОНКА <span>№ ${escape(event.edition)}</span></span>
  </header>
  <main>
    <section class="event-heading" aria-labelledby="event-title">
      <div><div class="eyebrow"><span class="eyebrow-line"></span>${escape(event.location)} <span class="dot-separator">/</span> Шоссе + МТБ</div><h1 id="event-title">${escape(event.title)}</h1><p>Один маршрут. Зачёт среди мужчин и женщин.</p></div>
      <div class="event-date"><span class="date-day">${date.getUTCDate()}</span><div><strong>${escape(month)} ${date.getUTCFullYear()}</strong><span>${escape(weekday)}</span><span class="heading-schedule">${event.meeting ? `Сбор ${escape(event.meeting.time)} · ` : ''}Старт ${escape(startLabel)}</span></div></div>
    </section>
    <section id="route" class="route-section" aria-labelledby="route-title">
      <div class="section-heading"><div class="section-title"><span class="section-number">01</span><h2 id="route-title">Маршрут заезда</h2></div><span class="status-pill"><span></span>${status}</span></div>
      <div class="route-grid">
        <div class="course-card">
          <div class="map-wrap"><div id="map" aria-label="Карта маршрута: старт и финиш, отметки километров"></div><div class="map-label">${icon('flag', 15)} МАРШРУТ № ${escape(event.edition)}</div><button id="fit-map" class="map-fit" aria-label="Показать весь маршрут" title="Показать весь маршрут">${icon('fit')}</button><span class="map-key"><span></span>Трек заезда</span><p class="map-error" hidden>Подложка карты недоступна. Трек маршрута показан; GPX можно скачать.</p></div>
          <div class="elevation"><div class="elevation-heading"><h3>${icon('mountain', 17)} Профиль высот</h3><span id="profile-readout">${number(course.minElevationM)}–${number(course.maxElevationM)} м</span></div><div id="profile"></div><div class="elevation-footer"><span>Расстояние, км</span><span>Высоты по GPX</span></div></div>
        </div>
        <aside class="route-aside" aria-label="Параметры маршрута и старт">
          <div class="distance-card"><div class="card-eyebrow">ДИСТАНЦИЯ ЗАЕЗДА ${icon('arrow', 21)}</div><div class="distance-value">${number(course.distanceM / 1000, 2)}<span>км</span></div><div class="terrain-stats"><div><span>↗ Набор высоты</span><strong>${number(course.ascentM)} <small>м</small></strong></div><div><span>↘ Спуск</span><strong>${number(course.descentM)} <small>м</small></strong></div></div><div class="route-points"><div><i class="start-dot"></i><span>Старт<strong>${course.points[0].lat.toFixed(5)}, ${course.points[0].lon.toFixed(5)}</strong></span></div><div><i class="finish-dot"></i><span>Финиш<strong>${course.points.at(-1).lat.toFixed(5)}, ${course.points.at(-1).lon.toFixed(5)}</strong></span></div></div><a href="./${escape(event.routeFile)}" download class="download-button">${icon('download', 19)} Скачать маршрут GPX ${icon('arrow', 19)}</a></div>
          <div class="start-card"><span class="small-label">${escape(weekday)} · ${escape(longDate)}</span>
            <dl class="event-schedule">${event.meeting ? `<div><dt>Сбор участников</dt><dd>${escape(event.meeting.time)}</dd></div>` : ''}<div><dt>Старт заезда${event.startApproximate ? '<small>ориентировочно</small>' : ''}</dt><dd>${escape(startLabel)}</dd></div></dl>
            <p>Местное время · ${escape(event.timezone)}</p>
            ${event.meeting ? `<div class="meeting-point"><h3>Точка сбора</h3><p>${meetingCoordinates}</p><button id="show-meeting" type="button">Показать на карте ${icon('fit', 16)}</button><a href="${meetingMapsUrl}" target="_blank" rel="noopener noreferrer">Открыть в картах ${icon('arrow', 16)}</a></div>` : ''}
          </div>
        </aside>
      </div>
    </section>
    <section id="results" class="results-section" aria-labelledby="results-title"><div class="section-heading"><div class="section-title"><span class="section-number">02</span><h2 id="results-title">Результаты</h2><span class="count-badge">${results.length}</span></div><span class="section-note">Полное время · с остановками</span></div><div class="results-card"><div class="results-toolbar"><div class="filters" role="group" aria-label="Зачёт"><button data-filter="all" class="selected" aria-pressed="true">Все</button><button data-filter="male" aria-pressed="false">Мужчины</button><button data-filter="female" aria-pressed="false">Женщины</button></div><span class="verified-note">Подтверждено организатором</span></div><div id="leaderboard" aria-live="polite"></div></div><p class="results-footnote">Места в зачёте определяются отдельно среди мужчин и женщин. При равном времени — одинаковое место.</p></section>
    <section id="participants" aria-labelledby="participants-title"><div class="section-heading"><div class="section-title"><span class="section-number">03</span><h2 id="participants-title">На старт выходят</h2><span class="count-badge">${participants.length}</span></div><span class="section-note">Шоссе и МТБ вместе</span></div><div class="rider-grid">${participants.length ? participants.map(rider => {
      const finished = results.some(r => r.riderId === rider.id);
      return `<article class="rider-card"><div class="rider-top"><span class="bib">${String(rider.bib).padStart(2, '0')}</span><span class="rider-category">${categories[rider.gender]}</span></div><h3>${escape(rider.name)}</h3><div class="rider-bottom"><span>${finished ? 'Результат принят' : event.status === 'upcoming' ? 'В стартовом списке' : 'Ожидаем результат'}</span>${icon(finished ? 'flag' : 'bike', 23)}</div></article>`;
    }).join('') : '<p class="empty-riders">Стартовый список скоро появится.</p>'}</div></section>
    <section id="rules" class="rules-section" aria-labelledby="rules-title"><div class="section-title"><span class="section-number">04</span><h2 id="rules-title">Как считаем результат</h2></div><div class="rules-grid"><article><span class="rule-index">/ 01</span><h3>Проезжаем маршрут</h3><p>Шоссе или МТБ — дистанция одна. Запустите запись с GPS до старта и завершите после финиша.</p></article><article><span class="rule-index">/ 02</span><h3>Передаём FIT</h3><p>После заезда передайте оригинальный FIT-файл организатору. Он проверит трек и время прохождения.</p></article><article><span class="rule-index">/ 03</span><h3>Сравниваем время</h3><p>Считаем всё время от старта до финиша, включая остановки. Победители — отдельно среди мужчин и женщин.</p></article></div></section>
  </main><footer><a class="footer-brand" href="#">${icon('bike', 24)} ${escape(event.title)}</a><span>Увидимся на старте.</span><a href="./${escape(event.routeFile)}" download>Забрать GPX ${icon('download', 16)}</a></footer>
  <dialog id="result-dialog"><div class="dialog-heading"><h2 id="result-name">Результат</h2><button id="close-dialog" class="icon-button" aria-label="Закрыть">${icon('close')}</button></div><div id="result-detail"></div></dialog>`;

const map = L.map('map', { scrollWheelZoom: false, zoomControl: false });
L.control.zoom({ position: 'topright' }).addTo(map);
const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);
tiles.on('tileerror', () => { document.querySelector('.map-error').hidden = false; });
const coords = course.points.map(p => [p.lat, p.lon]);
L.polyline(coords, { color: '#344436', weight: 7, opacity: 0.9 }).addTo(map);
const routeLine = L.polyline(coords, { color: '#c7ed43', weight: 3.5, opacity: 1 }).addTo(map);
const fitMap = () => map.fitBounds(routeLine.getBounds(), { padding: [45, 45] });
fitMap();
document.querySelector('#fit-map').addEventListener('click', fitMap);
const markerIcon = (text, type) => L.divIcon({ className: 'route-marker', html: `<span class="${type}">${text}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] });
L.marker(coords[0], { icon: markerIcon('С', 'marker-start'), title: 'Старт' }).addTo(map).bindPopup('Старт маршрута');
L.marker(coords.at(-1), { icon: markerIcon('Ф', 'marker-finish'), title: 'Финиш' }).addTo(map).bindPopup('Финиш маршрута');
if (event.meeting) {
  const meetingMarker = L.circleMarker([event.meeting.lat, event.meeting.lon], { color: '#fff', fillColor: '#337db6', fillOpacity: 1, weight: 2, radius: 7 })
    .addTo(map)
    .bindTooltip(`Сбор · ${escape(event.meeting.time)}`, { permanent: true, direction: 'left', offset: [-12, 0], className: 'meeting-tooltip' })
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
  L.marker([p.lat, p.lon], { icon: markerIcon(km, 'marker-km'), title: `${km} км` }).addTo(map).bindPopup(`${km} км`);
}
new ResizeObserver(() => map.invalidateSize()).observe(document.querySelector('#map'));

const width = 900, height = 142, top = 14, bottom = 112;
const maxElevation = Math.ceil(course.maxElevationM / 100) * 100;
const xFor = p => 34 + p.distanceM / course.distanceM * (width - 48);
const yFor = p => bottom - p.ele / maxElevation * (bottom - top);
const profilePath = course.points.map((p, i) => `${i ? 'L' : 'M'}${xFor(p).toFixed(2)},${yFor(p).toFixed(2)}`).join(' ');
document.querySelector('#profile').innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Профиль маршрута: ${number(course.distanceM / 1000, 2)} км, набор ${number(course.ascentM)} метров"><defs><linearGradient id="elevation-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#cde77a" stop-opacity=".75"/><stop offset="1" stop-color="#cde77a" stop-opacity=".12"/></linearGradient></defs>${[0, 200, 400].filter(n => n <= maxElevation).map(n => `<line x1="34" x2="886" y1="${yFor({ ele: n })}" y2="${yFor({ ele: n })}" stroke="#e6e9e1" stroke-dasharray="3 5"/><text x="0" y="${yFor({ ele: n }) + 4}" class="chart-label">${n}</text>`).join('')}<path d="${profilePath} L886,${bottom} L34,${bottom}Z" fill="url(#elevation-fill)"/><path d="${profilePath}" stroke="#6a872f" fill="none" stroke-width="2"/>${[0, 10, 20, 30, 40].filter(km => km * 1000 < course.distanceM).map(km => `<text x="${xFor({ distanceM: km * 1000 })}" y="137" text-anchor="middle" class="chart-label">${km}</text>`).join('')}<line id="profile-cursor" y1="10" y2="112" stroke="#30392b" stroke-dasharray="3 3" visibility="hidden"/></svg><input id="profile-position" class="sr-only" type="range" min="0" max="${course.points.length - 1}" value="0" aria-label="Исследовать высоты маршрута, используйте стрелки" />`;
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
    body.innerHTML = `<div class="empty-results"><span class="empty-icon">${icon('flag', 30)}</span><h3>${results.length ? 'В этом зачёте пока нет результатов' : event.status === 'upcoming' ? 'Заезд ещё впереди' : 'Ожидаем первые результаты'}</h3><p>${results.length ? 'Подтверждённые результаты появятся после проверки записей.' : event.status === 'upcoming' ? `Стартуем ${escape(longDate)}. После заезда здесь появятся<br class="desktop-break"> время, отставание и места участников.` : 'Результаты появятся здесь после проверки записей заезда.'}</p><span class="empty-date">${escape(event.title)} <span>/</span> ЗАЕЗД ${escape(event.edition)}</span></div>`;
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
  document.querySelector('#result-detail').innerHTML = `<div class="detail-metrics"><div><span>Полное время</span><strong>${formatTime(result.elapsedSeconds)}</strong></div><div><span>Ср. скорость по маршруту</span><strong>${number(course.distanceM / result.elapsedSeconds * 3.6, 1)} <small>км/ч</small></strong></div></div><div id="result-map" aria-label="Сравнение GPX маршрута и записи участника"></div><p class="detail-key"><span>Зелёный — маршрут</span><span>Синий — запись участника</span></p><p>${escape(result.note || 'Маршрут и время проверены организатором.')}</p><p class="detail-note">Оценка времени по GPS с точностью до секунды. Остановки включены. Запись показана только между стартом и финишем.</p>`;
  document.querySelector('#result-dialog').showModal();
  resultMap = L.map('result-map', { scrollWheelZoom: false });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(resultMap);
  L.polyline(coords, { color: '#819f34', weight: 5 }).addTo(resultMap);
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
