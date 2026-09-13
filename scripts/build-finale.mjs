import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Decoder, Stream } from '@garmin/fitsdk';
import { loadRace } from './course.mjs';
import { analyzeRide, decodeFit } from './timing.mjs';
import { analyzeMetrics, cleanTrack } from './finale-analysis.mjs';

const manifestPath = process.argv[2];
if (!manifestPath) throw new Error('Usage: node scripts/build-finale.mjs activities/finale/manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const { event, participants, course } = await loadRace();
const athletes = [], approved = [], replay = {};
for (const input of manifest) {
  const rider = participants.find(p => p.id === input.id);
  if (!rider) throw new Error(`Unknown rider ${input.id}`);
  const bytes = await readFile(input.file);
  const gps = decodeFit(bytes);
  const { messages } = new Decoder(Stream.fromBuffer(bytes)).read();
  const result = analyzeRide(gps, course, event.timing);
  const start = Date.parse(result.startedAt) / 1000;
  const end = result.finishedAt ? Date.parse(result.finishedAt) / 1000 : gps.at(-1).time;
  const records = new Map(messages.recordMesgs.map(r => [r.timestamp?.getTime() / 1000, r]));
  const { clean, rejected } = cleanTrack(gps.filter(p => p.time >= start && p.time <= end).map(p => {
    const r = records.get(p.time);
    return { ...p, altitude: r.enhancedAltitude ?? r.altitude ?? null, heart: r.heartRate ?? null, power: r.power ?? null, cadence: r.cadence ?? null };
  }));
  const metrics = analyzeMetrics(clean, messages.eventMesgs, course);
  const sourceHash = createHash('sha256').update(bytes).digest('hex');
  if (result.routeMatched) approved.push({ ...result, eventId: event.id, riderId: input.id, status: 'approved', courseHash: course.hash, sourceHash,
    note: 'GPS-время по стартовой и финишной зоне; паузы записи включены. Место подтверждено организатором.', approvedAt: new Date().toISOString() });
  const { projected, ...stats } = metrics;
  const athlete = { id: rider.id, name: rider.name, gender: rider.gender, bib: rider.bib, rank: input.rank,
    categoryRank: input.categoryRank, color: input.color, avatar: input.avatar,
    complete: result.routeMatched, start, end, sourceHash, rejectedGpsPoints: rejected.length,
    warnings: result.warnings, ...stats, courseAverageKmh: result.routeMatched ? +(course.distanceM / metrics.elapsed * 3.6).toFixed(1) : null };
  athletes.push(athlete);
  let lastTime = -Infinity;
  replay[rider.id] = projected.filter((p, i) => {
    const keep = i === 0 || i === projected.length - 1 || p.time - lastTime >= 8 || projected[i + 1]?.time - p.time > 20;
    if (keep) lastTime = p.time;
    return keep;
  }).map(p => [p.time, +p.lat.toFixed(6), +p.lon.toFixed(6), Math.round(p.courseM), Math.round(p.gpsM), p.altitude === null ? null : Math.round(p.altitude)]);
  console.log(JSON.stringify({ id: athlete.id, complete: athlete.complete, elapsed: athlete.elapsed, distance: athlete.gpsDistanceM,
    pauses: athlete.pausedSeconds, dwells: athlete.dwells.sort((a,b)=>b.seconds-a.seconds).slice(0,5), splits: athlete.splits.map(s=>[s.toKm,s.seconds,s.speed]), peak: athlete.peak, sensors: athlete.sensors, rejected: rejected.length }));
}
const finale = { eventId: event.id, courseHash: course.hash, builtAt: new Date().toISOString(),
  start: Math.min(...athletes.map(a=>a.start)), end: Math.max(...athletes.map(a=>a.end)), athletes };
await mkdir('activities/finale', { recursive: true });
await writeFile('data/results.json', JSON.stringify(approved) + '\n');
await writeFile('data/finale.json', JSON.stringify(finale, null, 2) + '\n');
await writeFile('public/race-replay.json', JSON.stringify({ eventId: event.id, courseHash: course.hash, tracks: replay }));
