import { mkdir, writeFile } from 'node:fs/promises';
import { loadRace } from './course.mjs';

const race = await loadRace();
await mkdir('src/generated', { recursive: true });
await writeFile('src/generated/race.json', JSON.stringify(race));
console.log(`Маршрут: ${(race.course.distanceM / 1000).toFixed(2)} км. Участники: ${race.participants.length}. Результаты: ${race.results.length}.`);
