import { Decoder, Stream } from '@garmin/fitsdk';
import { distance } from '../src/lib/race.js';

export function decodeFit(bytes) {
  const decoder = new Decoder(Stream.fromBuffer(bytes));
  if (!decoder.isFIT() || !decoder.checkIntegrity()) throw new Error('FIT повреждён или не прошёл проверку CRC. Экспортируйте оригинальный файл заново.');
  const { messages, errors } = decoder.read();
  if (errors.length) throw new Error(`Не удалось прочитать FIT: ${errors.map(String).join('; ')}`);
  if (messages.fileIdMesgs?.[0]?.type !== 'activity') throw new Error('Нужен FIT с записью активности, а не с маршрутом или тренировочным планом.');
  const records = (messages.recordMesgs || []).filter(r => r.timestamp instanceof Date && Number.isFinite(r.positionLat) && Number.isFinite(r.positionLong))
    .map(r => ({ lat: r.positionLat * 180 / 2 ** 31, lon: r.positionLong * 180 / 2 ** 31, time: r.timestamp.getTime() / 1000 }));
  if (records.length < 2) throw new Error('В FIT нет достаточного количества GPS-точек с временем.');
  if (records.some(p => !Number.isFinite(p.time) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180)) throw new Error('Некорректные GPS-координаты или время в FIT.');
  if (records.some((p, i) => i && p.time < records[i - 1].time)) throw new Error('Время GPS-точек идёт назад. Проверьте запись.');
  // Identical timestamps cannot define a timed segment. Retain the final sample.
  return records.filter((p, i) => i === records.length - 1 || p.time !== records[i + 1].time);
}

export function checkpoints(course, everyM) {
  const gates = [];
  let segment = 1;
  for (let target = everyM; target < course.distanceM - everyM / 2; target += everyM) {
    while (segment < course.points.length - 1 && course.points[segment].distanceM < target) segment++;
    const a = course.points[segment - 1], b = course.points[segment];
    const fraction = (target - a.distanceM) / (b.distanceM - a.distanceM || 1);
    gates.push({ lat: a.lat + (b.lat - a.lat) * fraction, lon: a.lon + (b.lon - a.lon) * fraction, distanceM: target });
  }
  return gates;
}

function nearestPass(records, point, radius, from, to = records.length - 1) {
  let best = -1, minimum = Infinity;
  for (let i = from; i <= to; i++) {
    const gap = distance(records[i], point);
    if (gap <= radius && gap <= minimum) { best = i; minimum = gap; }
    else if (gap > radius && best !== -1) break;
  }
  return best;
}

function manualIndex(records, iso, gate, settings) {
  if (!/T.*(Z|[+-]\d{2}:\d{2})$/.test(iso)) throw new Error('Ручное время должно быть ISO с часовым поясом: 2026-09-13T09:00:00+03:00');
  const time = Date.parse(iso) / 1000;
  if (!Number.isFinite(time)) throw new Error('Некорректная ручная отметка времени');
  let index = 0;
  records.forEach((p, i) => { if (Math.abs(p.time - time) < Math.abs(records[index].time - time)) index = i; });
  if (Math.abs(records[index].time - time) > settings.maxGapSeconds || distance(records[index], gate) > settings.gateRadiusM) {
    throw new Error('Ручная отметка не соответствует GPS-точке у старта / финиша.');
  }
  return { index, time };
}

export function analyzeRide(records, course, settings, options = {}) {
  const warnings = [];
  if (records.length < 2) throw new Error('Нужно минимум две GPS-точки');
  const manualStart = options.start ? manualIndex(records, options.start, course.points[0], settings) : null;
  const manualFinish = options.finish ? manualIndex(records, options.finish, course.points.at(-1), settings) : null;
  const start = manualStart?.index ?? nearestPass(records, course.points[0], settings.gateRadiusM, 0);
  if (start < 0) throw new Error('В записи не найден старт маршрута.');
  let cursor = start;
  const gates = checkpoints(course, settings.checkpointEveryM);
  let matched = 0;
  for (const gate of gates) {
    const index = nearestPass(records, gate, settings.checkpointRadiusM, cursor, manualFinish?.index);
    if (index < 0) break;
    cursor = index;
    matched++;
  }
  const finish = manualFinish?.index ?? nearestPass(records, course.points.at(-1), settings.gateRadiusM, cursor + 1);
  const routeMatched = matched === gates.length && finish > start;
  if (!routeMatched) warnings.push(`Маршрут пройден не полностью или не по порядку: ${matched} из ${gates.length} контрольных точек. Финиш ${finish > start ? 'найден' : 'не найден'}.`);
  if (manualStart || manualFinish) warnings.push('Использована ручная отметка времени. Проверьте её перед подтверждением.');
  const segment = records.slice(start, finish > start ? finish + 1 : records.length);
  let distanceM = 0, maxGapSeconds = 0, maxSpeedKmh = 0;
  segment.forEach((p, i) => {
    if (!i) return;
    const gap = p.time - segment[i - 1].time;
    const length = distance(segment[i - 1], p);
    distanceM += length;
    maxGapSeconds = Math.max(maxGapSeconds, gap);
    if (gap > 0) maxSpeedKmh = Math.max(maxSpeedKmh, length / gap * 3.6);
  });
  if (maxGapSeconds > settings.maxGapSeconds) warnings.push(`Разрыв GPS-записи до ${Math.round(maxGapSeconds)} с. Проверьте время и прохождение маршрута.`);
  if (maxSpeedKmh > 100) warnings.push(`GPS показывает скорость до ${Math.round(maxSpeedKmh)} км/ч. Возможен скачок координат.`);
  if (routeMatched && Math.abs(distanceM - course.distanceM) / course.distanceM > 0.08) warnings.push('Дистанция записи отличается от GPX более чем на 8%. Проверьте трек.');
  const startedAt = new Date((manualStart?.time ?? records[start].time) * 1000).toISOString();
  const finishedAt = finish > start ? new Date((manualFinish?.time ?? records[finish].time) * 1000).toISOString() : null;
  const elapsedSeconds = routeMatched ? Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1000) : null;
  if (elapsedSeconds !== null && elapsedSeconds <= 0) throw new Error('Финиш должен быть позже старта');
  const stride = Math.max(1, Math.ceil(segment.length / 1200));
  const trace = segment.filter((_, i) => i % stride === 0 || i === segment.length - 1).map(p => ({ lat: p.lat, lon: p.lon }));
  return { routeMatched, elapsedSeconds, startedAt, finishedAt, distanceM: Math.round(distanceM), checkpointsMatched: matched, checkpointsTotal: gates.length, maxGapSeconds, warnings, trace };
}
