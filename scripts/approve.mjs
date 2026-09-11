import { writeFile, rename } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { loadRace, readJSON } from './course.mjs';
import { validateData } from '../src/lib/race.js';

try {
  const { values } = parseArgs({ options: { rider: { type: 'string' }, note: { type: 'string' }, replace: { type: 'boolean', default: false } } });
  const { event, participants, course, results } = await loadRace();
  if (!participants.some(r => r.id === values.rider)) throw new Error('Укажите существующего участника: npm run approve -- --rider ruslan-shchur');
  const draft = await readJSON(`activities/reviews/${values.rider}.json`);
  if (draft.eventId !== event.id || draft.riderId !== values.rider || draft.courseHash !== course.hash) throw new Error('Черновик относится к другому заезду или маршрут изменился. Повторите импорт.');
  if (!draft.routeMatched || !draft.elapsedSeconds) throw new Error('Нельзя подтвердить неполный маршрут. Проверьте GPX и FIT.');
  if (draft.warnings.length && !values.note?.trim()) throw new Error('Есть предупреждения. После проверки укажите --note с объяснением.');
  if (results.some(r => r.riderId === values.rider) && !values.replace) throw new Error('Результат уже есть. Для замены добавьте --replace.');
  const accepted = { ...draft, status: 'approved', note: values.note?.trim() || '', approvedAt: new Date().toISOString() };
  const updated = [...results.filter(r => r.riderId !== values.rider), accepted];
  validateData(event, participants, updated);
  await writeFile('data/results.json.tmp', JSON.stringify(updated, null, 2) + '\n');
  await rename('data/results.json.tmp', 'data/results.json');
  console.log('Результат подтверждён в data/results.json. Выполните npm run build, затем коммит и push. Для обновления локального предпросмотра перезапустите npm run dev.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
