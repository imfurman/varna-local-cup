import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Encoder, Profile } from '@garmin/fitsdk';
import { parseCourse, loadRace } from '../scripts/course.mjs';
import { analyzeRide, decodeFit } from '../scripts/timing.mjs';
import { leaderboard, validateData } from '../src/lib/race.js';

const xml = await readFile(new URL('../public/route.gpx', import.meta.url), 'utf8');
const course = parseCourse(xml);
const liveRace = await loadRace();
const race = {
  event: { ...liveRace.event, id: '2026-09-13', date: '2026-09-13', timezone: 'Europe/Sofia' },
  participants: [
    { id: 'ruslan-shchur', bib: 1, name: 'Тестовый участник', gender: 'male' },
    { id: 'test-rider', bib: 2, name: 'Вторая участница', gender: 'female' },
  ],
};
const startTime = Date.parse('2026-09-13T06:00:00Z') / 1000;

function simulatedRide() {
  const points = [];
  for (let i = 1; i < course.points.length; i++) {
    const a = course.points[i - 1], b = course.points[i];
    const steps = Math.max(1, Math.ceil((b.distanceM - a.distanceM) / 25));
    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      points.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t, time: startTime + points.length * 3 });
    }
  }
  points.push({ ...course.points.at(-1), time: startTime + points.length * 3 });
  return points;
}

function encode(records) {
  const encoder = new Encoder();
  encoder.onMesg(Profile.MesgNum.FILE_ID, { type: 'activity', manufacturer: 'development', product: 1, timeCreated: new Date(startTime * 1000) });
  for (const p of records) encoder.onMesg(Profile.MesgNum.RECORD, { timestamp: new Date(p.time * 1000), positionLat: Math.round(p.lat * 2 ** 31 / 180), positionLong: Math.round(p.lon * 2 ** 31 / 180) });
  return Buffer.from(encoder.close());
}

test('GPX produces valid cumulative distances and consistent elevation totals', () => {
  assert.ok(course.distanceM > 0);
  assert.ok(course.points.every((p, i) => i === 0 || p.distanceM >= course.points[i - 1].distanceM));
  assert.ok(Math.abs(course.ascentM - course.descentM - (course.points.at(-1).ele - course.points[0].ele)) < 0.001);
  assert.ok(course.points.length >= 2);
});

test('Garmin FIT round trip matches route and counts a 2-minute stopped interval', () => {
  const points = simulatedRide();
  const halfway = Math.floor(points.length / 2);
  const stopped = points.flatMap((p, i) => i === halfway ? [p, { ...p, time: p.time + 120 }] : [{ ...p, time: p.time + (i > halfway ? 120 : 0) }]);
  const result = analyzeRide(decodeFit(encode(stopped)), course, race.event.timing);
  assert.equal(result.routeMatched, true);
  assert.equal(result.elapsedSeconds, points.at(-1).time - points[0].time + 120);
  assert.equal(result.checkpointsMatched, result.checkpointsTotal);
  assert.ok(result.warnings.some(w => w.includes('Разрыв')));
});

test('warm-up and cooldown are excluded', () => {
  const points = simulatedRide();
  const withExtra = [{ lat: points[0].lat - .01, lon: points[0].lon, time: startTime - 300 }, ...points,
    { lat: points.at(-1).lat + .01, lon: points.at(-1).lon, time: points.at(-1).time + 300 }];
  const result = analyzeRide(withExtra, course, race.event.timing);
  assert.equal(result.elapsedSeconds, points.at(-1).time - points[0].time);
  assert.equal(result.startedAt, new Date(startTime * 1000).toISOString());
  assert.ok(!result.warnings.length);
});

test('shortcut, reversed route and missing finish never qualify', () => {
  const points = simulatedRide();
  const cut = points.filter((_, i) => i < points.length * .35 || i > points.length * .6);
  assert.equal(analyzeRide(cut, course, race.event.timing).routeMatched, false);
  assert.equal(analyzeRide(points.slice(0, -100), course, race.event.timing).elapsedSeconds, null);
  const reverse = [...points].reverse().map((p, i) => ({ ...p, time: startTime + i * 3 }));
  assert.equal(analyzeRide(reverse, course, race.event.timing).routeMatched, false);
});

test('manual gate times require zone and matching coordinates', () => {
  const points = simulatedRide();
  assert.throws(() => analyzeRide(points, course, race.event.timing, { start: '2026-09-13T09:00:00' }), /часовым поясом/);
  assert.throws(() => analyzeRide(points, course, race.event.timing, { start: '2026-09-13T09:40:00+03:00' }), /не соответствует/);
  const result = analyzeRide(points, course, race.event.timing, { start: '2026-09-13T09:00:01+03:00' });
  assert.equal(result.elapsedSeconds, points.at(-1).time - startTime - 1);
  assert.ok(result.warnings.some(w => w.includes('ручная')));
});

test('corrupted FIT is rejected', () => {
  const bytes = encode(simulatedRide());
  bytes[bytes.length - 1] ^= 255;
  assert.throws(() => decodeFit(bytes), /CRC/);
  assert.throws(() => decodeFit(Buffer.from('not a fit file')));
});

test('gender classifications, ties, gaps and unapproved records', () => {
  const riders = [{ id: 'a', name: 'А', gender: 'male' }, { id: 'b', name: 'Б', gender: 'male' }, { id: 'c', name: 'В', gender: 'male' }, { id: 'd', name: 'Г', gender: 'female' }];
  const results = [100, 100, 120, 90].map((elapsedSeconds, i) => ({ riderId: riders[i].id, elapsedSeconds, status: 'approved' }));
  results.push({ riderId: 'a', elapsedSeconds: 10, status: 'pending' });
  assert.deepEqual(leaderboard(riders, results, 'male').map(r => [r.rank, r.gap]), [[1, 0], [1, 0], [3, 20]]);
  assert.equal(leaderboard(riders, results, 'female')[0].riderId, 'd');
  assert.equal(leaderboard(riders, results)[0].elapsedSeconds, 90);
});

test('validation rejects duplicate rider bibs and invalid category', () => {
  const riders = structuredClone(race.participants);
  riders[1].bib = riders[0].bib;
  assert.throws(() => validateData(race.event, riders, []), /Номера/);
  riders[1].bib = 2; riders[1].gender = 'road';
  assert.throws(() => validateData(race.event, riders, []), /пол/);
});

test('CLI import → local review → approve, duplicate protection, stale course rejection', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'varna-cup-test-'));
  try {
    await cp('data', join(directory, 'data'), { recursive: true });
    await rm(join(directory, 'data/finale.json'), { force: true }); // This fixture represents a new race, before the finale.
    await writeFile(join(directory, 'data/event.json'), JSON.stringify({ ...race.event, routeFile: 'route.gpx' }));
    await writeFile(join(directory, 'data/participants.json'), JSON.stringify(race.participants));
    await writeFile(join(directory, 'data/results.json'), '[]');
    await mkdir(join(directory, 'public'));
    await writeFile(join(directory, 'public/route.gpx'), xml);
    await writeFile(join(directory, 'ride.fit'), encode(simulatedRide()));
    const run = (script, ...args) => spawnSync(process.execPath, [resolve(`scripts/${script}.mjs`), ...args], { cwd: directory, encoding: 'utf8' });
    const imported = run('import-fit', '--rider', 'ruslan-shchur', '--file', 'ride.fit');
    assert.equal(imported.status, 0, imported.stderr + imported.stdout);
    const html = await readFile(join(directory, 'activities/reviews/ruslan-shchur.html'), 'utf8');
    assert.match(html, /Тестовый участник/);
    assert.match(html, /<svg/);
    assert.notEqual(run('import-fit', '--rider', 'ruslan-shchur', '--file', 'ride.fit').status, 0);
    const approved = run('approve', '--rider', 'ruslan-shchur');
    assert.equal(approved.status, 0, approved.stderr);
    const results = JSON.parse(await readFile(join(directory, 'data/results.json'), 'utf8'));
    assert.equal(results[0].status, 'approved');
    assert.equal(results[0].routeMatched, true);
    assert.notEqual(run('approve', '--rider', 'ruslan-shchur').status, 0);
    await writeFile(join(directory, 'public/route.gpx'), xml + '\n');
    assert.notEqual(run('import-fit', '--rider', 'ruslan-shchur', '--file', 'ride.fit', '--replace').status, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
