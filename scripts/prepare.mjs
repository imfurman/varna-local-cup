import { mkdir, writeFile } from 'node:fs/promises';
import { loadRace } from './course.mjs';

const race = await loadRace();
await mkdir('src/generated', { recursive: true });
// The finale fetches all replay tracks separately; do not duplicate legacy traces in the JS bundle.
const clientRace = race.finale ? { ...race, results: race.results.map(({ trace, ...result }) => result) } : race;
await writeFile('src/generated/race.json', JSON.stringify(clientRace));
console.log(`Маршрут: ${(race.course.distanceM / 1000).toFixed(2)} км. Участники: ${race.participants.length}. Результаты: ${race.results.length}.`);
