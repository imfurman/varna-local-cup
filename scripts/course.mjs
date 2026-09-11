import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { distance, validateData } from '../src/lib/race.js';

export async function readJSON(path) { return JSON.parse(await readFile(path, 'utf8')); }

export async function loadRace() {
  const [event, participants, results] = await Promise.all([
    readJSON('data/event.json'), readJSON('data/participants.json'), readJSON('data/results.json'),
  ]);
  validateData(event, participants, results);
  const xml = await readFile(`public/${event.routeFile}`, 'utf8');
  const course = parseCourse(xml);
  const courseHash = createHash('sha256').update(xml).update(JSON.stringify(event.timing)).digest('hex');
  for (const r of results) {
    if (r.courseHash !== courseHash) throw new Error(`Маршрут / настройки изменились после расчёта результата ${r.riderId}. Пересчитайте FIT.`);
  }
  return { event, participants, results, course: { ...course, hash: courseHash } };
}

export function parseCourse(xml) {
  if (XMLValidator.validate(xml) !== true) throw new Error('Некорректный XML в GPX');
  const doc = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true }).parse(xml);
  const segments = doc.gpx?.trk?.trkseg;
  if (!segments || Array.isArray(segments)) throw new Error('Маршрут должен содержать один непрерывный trkseg');
  const raw = segments.trkpt;
  if (!Array.isArray(raw) || raw.length < 2) throw new Error('GPX должен содержать минимум две точки');
  let distanceM = 0, ascentM = 0, descentM = 0;
  const points = raw.map((p, i) => {
    const point = { lat: Number(p['@_lat']), lon: Number(p['@_lon']), ele: Number(p.ele) };
    if (!Number.isFinite(point.lat) || Math.abs(point.lat) > 90 || !Number.isFinite(point.lon) || Math.abs(point.lon) > 180 || !Number.isFinite(point.ele)) {
      throw new Error(`Некорректная координата / высота GPX, точка ${i + 1}`);
    }
    return point;
  });
  points.forEach((p, i) => {
    if (i) {
      distanceM += distance(points[i - 1], p);
      const delta = p.ele - points[i - 1].ele;
      ascentM += Math.max(0, delta); descentM += Math.max(0, -delta);
    }
    p.distanceM = distanceM;
  });
  if (distanceM <= 0) throw new Error('Маршрут имеет нулевую длину');
  return { points, distanceM, ascentM, descentM, minElevationM: Math.min(...points.map(p => p.ele)), maxElevationM: Math.max(...points.map(p => p.ele)) };
}
