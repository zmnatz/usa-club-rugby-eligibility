import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { clubsToBuild, parseScreenshotsSection } from './lib/plan.ts';

// Works out BUILD_CLUBS for a PR's screenshot build, as a GitHub Actions output.
//   node playwright/build-clubs.ts --default <club-key> --pr-body body.md --data public/data
const { values } = parseArgs({
  options: {
    default: { type: 'string' },
    'pr-body': { type: 'string' },
    data: { type: 'string', default: 'public/data' },
  },
});
const data = values.data as string;
const readJson = <T>(file: string) => JSON.parse(fs.readFileSync(path.join(data, file), 'utf-8')) as T;

const clubs = readJson<{ clubs: { key: string }[] }>('index.json').clubs.map((club) => club.key);
const playerClubs = new Map<string, string[]>();
for (const club of clubs) {
  for (const { playerId } of readJson<{ rows: { playerId: string }[] }>(`clubs/${club}.json`).rows) {
    playerClubs.set(playerId, [...(playerClubs.get(playerId) ?? []), club]);
  }
}

const wanted = clubsToBuild({
  defaults: [values.default as string],
  requested: parseScreenshotsSection(fs.readFileSync(values['pr-body'] as string, 'utf-8')),
  clubs,
  playerClubs,
});
console.log(`clubs=${wanted.join(',')}`);
