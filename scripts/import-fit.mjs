import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { loadRace } from './course.mjs';
import { analyzeRide, decodeFit } from './timing.mjs';
import { formatTime } from '../src/lib/race.js';
import { reviewHTML } from './review.mjs';

try {
  const { values } = parseArgs({ options: {
    rider: { type: 'string' }, file: { type: 'string' }, start: { type: 'string' }, finish: { type: 'string' }, replace: { type: 'boolean', default: false },
  } });
  if (!values.rider || !values.file) throw new Error('Использование: npm run import:fit -- --rider ruslan-shchur --file /путь/ride.fit [--start ISO --finish ISO] [--replace]');
  const { event, participants, course, results } = await loadRace();
  const rider = participants.find(r => r.id === values.rider);
  if (!rider) throw new Error(`Нет участника ${values.rider} в data/participants.json`);
  const output = `activities/reviews/${rider.id}.json`;
  if (!values.replace && (results.some(r => r.riderId === rider.id) || await access(output).then(() => true, () => false))) throw new Error('У участника уже есть результат / черновик. Для пересчёта укажите --replace.');
  const bytes = await readFile(values.file);
  const analysis = analyzeRide(decodeFit(bytes), course, event.timing, values);
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: event.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(analysis.startedAt));
  if (localDate !== event.date) analysis.warnings.push(`Дата записи ${localDate} не совпадает с датой заезда ${event.date}.`);
  const proposal = { eventId: event.id, riderId: rider.id, status: 'pending', ...analysis, courseHash: course.hash, sourceHash: createHash('sha256').update(bytes).digest('hex'), note: '' };
  await mkdir('activities/reviews', { recursive: true });
  await writeFile(output, JSON.stringify(proposal, null, 2) + '\n');
  await writeFile(`activities/reviews/${rider.id}.html`, reviewHTML(proposal, rider, course));
  console.log(`${rider.name}: ${formatTime(proposal.elapsedSeconds)}; контрольные точки ${proposal.checkpointsMatched}/${proposal.checkpointsTotal}.`);
  console.log(`Старт: ${proposal.startedAt}. Финиш: ${proposal.finishedAt || 'не найден'}.`);
  for (const warning of proposal.warnings) console.log(`Внимание: ${warning}`);
  console.log(`Проверка: activities/reviews/${rider.id}.html (откройте в браузере). Черновик: ${output}`);
  console.log('После проверки: npm run approve -- --rider ' + rider.id);
  if (!analysis.routeMatched) process.exitCode = 2;
} catch (error) { console.error(error.message); process.exitCode = 1; }
