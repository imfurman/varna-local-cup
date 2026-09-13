import { distance } from '../src/lib/race.js';

export function cleanTrack(records) {
  const clean = [], rejected = [];
  for (const p of records) {
    const last = clean.at(-1);
    if (last && (p.time <= last.time || distance(last, p) / (p.time - last.time) > 100 / 3.6)) {
      rejected.push(p.time); continue;
    }
    clean.push(p);
  }
  return { clean, rejected };
}

export function projectPoint(p, course) {
  const scale = Math.cos(p.lat * Math.PI / 180);
  let best = { gap: Infinity, distanceM: 0 };
  for (let i = 1; i < course.points.length; i++) {
    const a = course.points[i - 1], b = course.points[i];
    const dx = (b.lon - a.lon) * scale, dy = b.lat - a.lat;
    const f = Math.max(0, Math.min(1, (((p.lon - a.lon) * scale) * dx + (p.lat - a.lat) * dy) / (dx * dx + dy * dy || 1)));
    const gap = distance(p, { lat: a.lat + dy * f, lon: a.lon + (b.lon - a.lon) * f });
    if (gap < best.gap) best = { gap, distanceM: a.distanceM + (b.distanceM - a.distanceM) * f };
  }
  return best;
}

// A spatial dwell, independent of the device's unreliable speed during auto-pause.
export function findDwells(points, radius = 45, minimumSeconds = 45) {
  const stops = [];
  let i = 0;
  while (i < points.length - 1) {
    let j = i + 1;
    while (j < points.length && distance(points[i], points[j]) <= radius) j++;
    const end = j - 1, duration = points[end].time - points[i].time;
    if (duration >= minimumSeconds) {
      stops.push({ start: points[i].time, end: points[end].time, seconds: duration, lat: points[i].lat, lon: points[i].lon, courseM: points[i].courseM });
      i = Math.max(i + 1, end);
    } else i++;
  }
  return stops;
}

export function timerPauses(events, start, end) {
  const pauses = []; let stopped = null;
  for (const event of events || []) {
    if (event.event !== 'timer' || !(event.timestamp instanceof Date)) continue;
    const time = event.timestamp.getTime() / 1000;
    if (event.eventType?.startsWith('stop') && stopped === null) stopped = time;
    if (event.eventType === 'start' && stopped !== null) {
      const a = Math.max(start, stopped), b = Math.min(end, time);
      if (b > a) pauses.push({ start: a, end: b, seconds: b - a });
      stopped = null;
    }
  }
  if (stopped !== null && end > Math.max(start, stopped)) pauses.push({ start: Math.max(start, stopped), end, seconds: end - Math.max(start, stopped) });
  return pauses;
}

export function analyzeMetrics(points, events, course) {
  let cum = 0;
  const projected = points.map((p, i) => {
    if (i) cum += distance(points[i - 1], p);
    const projection = projectPoint(p, course);
    return { ...p, courseM: projection.distanceM, courseGap: projection.gap, gpsM: cum };
  });
  const elapsed = points.at(-1).time - points[0].time;
  const pauses = timerPauses(events, points[0].time, points.at(-1).time);
  const dwells = findDwells(projected);
  const pausedSeconds = pauses.reduce((s, p) => s + p.seconds, 0);
  const dwellSeconds = dwells.reduce((s, p) => s + p.seconds, 0);
  const movingSeconds = Math.max(1, elapsed - (pauses.length ? pausedSeconds : dwellSeconds));
  const splits = []; let cursor = 0, previousTime = points[0].time, previousKm = 0;
  for (let km = 5; km <= 40; km += 5) {
    const gate = course.points.reduce((a, b) => Math.abs(a.distanceM - km * 1000) < Math.abs(b.distanceM - km * 1000) ? a : b);
    let found = -1, best = Infinity;
    for (let j = cursor; j < projected.length; j++) {
      const gap = distance(projected[j], gate);
      if (gap < 120 && gap < best) { found = j; best = gap; }
      else if (found >= 0 && gap > 120) break;
    }
    if (found < 0) break;
    const seconds = projected[found].time - previousTime;
    splits.push({ fromKm: previousKm, toKm: km, start: previousTime, end: projected[found].time, seconds, speed: +(18000 / seconds).toFixed(1) });
    previousTime = projected[found].time; previousKm = km; cursor = found;
  }
  let peak = { speed: 0 }, j = 0;
  for (let i = 0; i < projected.length; i++) {
    while (j + 1 < projected.length && projected[i].time - projected[j + 1].time >= 30) j++;
    const span = projected[i].time - projected[j].time;
    if (span < 30 || span > 50) continue;
    const speed = (projected[i].gpsM - projected[j].gpsM) / span * 3.6;
    if (speed > peak.speed && speed <= 80) peak = { speed: +speed.toFixed(1), start: projected[j].time, end: projected[i].time, courseM: projected[i].courseM };
  }
  const sensors = {};
  for (const key of ['heart', 'power', 'cadence']) {
    let sum = 0, weight = 0, max = 0;
    for (let i = 1; i < projected.length; i++) {
      const p = projected[i];
      if (!Number.isFinite(p[key]) || (key !== 'power' && p[key] <= 0)) continue;
      const dt = Math.min(15, p.time - projected[i - 1].time);
      sum += p[key] * dt; weight += dt; max = Math.max(max, p[key]);
    }
    if (weight > 60) sensors[key] = { average: Math.round(sum / weight), max, coverage: Math.min(100, Math.round(weight / elapsed * 100)) };
  }
  // Smooth altitude spatially: one sample per >= 50 m, ignore sub-3 m fluctuations.
  let altitude = null, ascent = 0, descent = 0, lastM = -50;
  for (const p of projected) {
    if (!Number.isFinite(p.altitude) || p.gpsM - lastM < 50) continue;
    if (altitude === null) { altitude = p.altitude; lastM = p.gpsM; continue; }
    const delta = p.altitude - altitude;
    if (Math.abs(delta) >= 3) { ascent += Math.max(0, delta); descent += Math.max(0, -delta); altitude = p.altitude; }
    lastM = p.gpsM;
  }
  return { projected, elapsed, gpsDistanceM: Math.round(cum), pausedSeconds, dwellSeconds, movingSeconds,
    movingBasis: pauses.length ? 'device' : 'spatial', pauses, dwells, splits, peak, sensors,
    ascentM: altitude === null ? null : Math.round(ascent), descentM: altitude === null ? null : Math.round(descent) };
}
