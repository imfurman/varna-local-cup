export const categories = { male: 'Мужчины', female: 'Женщины' };

export function distance(a, b) {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const value = Math.round(seconds);
  return [Math.floor(value / 3600), Math.floor(value / 60) % 60, value % 60]
    .map(n => String(n).padStart(2, '0')).join(':');
}

export function leaderboard(participants, results, category = 'all') {
  const riders = new Map(participants.map(r => [r.id, r]));
  const rows = results.filter(r => r.status === 'approved' && riders.has(r.riderId))
    .map(r => ({ ...r, rider: riders.get(r.riderId) }))
    .filter(r => category === 'all' || r.rider.gender === category)
    .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds || a.rider.name.localeCompare(b.rider.name, 'ru'));
  let rank = 0;
  return rows.map((r, i) => {
    if (i === 0 || r.elapsedSeconds !== rows[i - 1].elapsedSeconds) rank = i + 1;
    return { ...r, rank, gap: r.elapsedSeconds - rows[0].elapsedSeconds };
  });
}

export function validateData(event, participants, results) {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  assert(event && typeof event === 'object', 'Не задан заезд');
  for (const key of ['id', 'title', 'edition', 'location', 'timezone']) {
    assert(typeof event[key] === 'string' && event[key].trim(), `event.${key}: нужна непустая строка`);
  }
  assert(/^\d{4}-\d{2}-\d{2}$/.test(event.date) && new Date(`${event.date}T12:00:00Z`).toISOString().slice(0, 10) === event.date, 'Некорректная дата заезда');
  new Intl.DateTimeFormat('ru', { timeZone: event.timezone });
  assert(event.startTime === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(event.startTime), 'Время старта: HH:MM или null');
  assert(['upcoming', 'results', 'finished'].includes(event.status), 'Неизвестный статус заезда');
  assert(event.ranking === 'gender', 'ranking: gender — зачёт по полу');
  assert(/^[a-zA-Z0-9_.-]+\.gpx$/i.test(event.routeFile), 'routeFile: имя GPX в public/');
  for (const key of ['gateRadiusM', 'checkpointEveryM', 'checkpointRadiusM', 'maxGapSeconds']) {
    assert(Number.isFinite(event.timing?.[key]) && event.timing[key] > 0, `timing.${key} должен быть положительным`);
  }
  assert(Array.isArray(participants) && Array.isArray(results), 'Участники и результаты должны быть массивами');
  const ids = new Set();
  const bibs = new Set();
  for (const rider of participants) {
    assert(typeof rider.id === 'string' && /^[a-z0-9-]+$/.test(rider.id) && !ids.has(rider.id), 'ID участника должен быть уникальным: латиница, цифры, дефис');
    assert(typeof rider.name === 'string' && rider.name.trim(), `Нет имени: ${rider.id}`);
    assert(Object.hasOwn(categories, rider.gender), `Неизвестный пол: ${rider.id}`);
    assert(Number.isInteger(rider.bib) && rider.bib > 0 && !bibs.has(rider.bib), 'Номера участников должны быть положительными и уникальными');
    ids.add(rider.id); bibs.add(rider.bib);
  }
  const resultIds = new Set();
  for (const result of results) {
    assert(ids.has(result.riderId) && !resultIds.has(result.riderId), `Неизвестный или повторный участник в результатах: ${result.riderId}`);
    assert(result.eventId === event.id, `Результат другого заезда: ${result.riderId}`);
    assert(result.status === 'approved', 'В results.json разрешены только подтверждённые результаты');
    assert(Number.isInteger(result.elapsedSeconds) && result.elapsedSeconds > 0, 'elapsedSeconds: положительное целое число');
    assert(Number.isFinite(result.distanceM) && result.distanceM > 0, 'Некорректная дистанция результата');
    assert(Number.isFinite(Date.parse(result.startedAt)) && Number.isFinite(Date.parse(result.finishedAt)), 'Некорректные отметки старта / финиша');
    assert(Math.round((Date.parse(result.finishedAt) - Date.parse(result.startedAt)) / 1000) === result.elapsedSeconds, 'Время результата не соответствует отметкам старта / финиша');
    assert(result.routeMatched === true && typeof result.courseHash === 'string', 'Нет подтверждения прохождения маршрута');
    assert(Array.isArray(result.trace) && result.trace.length >= 2 && result.trace.every(p => Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 && Number.isFinite(p.lon) && Math.abs(p.lon) <= 180), 'Некорректный трек результата');
    assert(typeof result.note === 'string', 'Примечание результата должно быть строкой');
    resultIds.add(result.riderId);
  }
}
