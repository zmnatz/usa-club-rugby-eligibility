import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { PlayerProfile } from '@zmnatz/usa-club-rugby-data';
import { type PlayerBucketFile, PLAYER_DATA_DIR, playerBucket } from './playerBuckets';
import { listPlayerIds, published } from './published';

// Writes every player's profile in this build to public/player-data/<bucket>.json, which
// the player page loads in the browser; `dev` and `build` run this first. The files are
// gitignored: they're worked out from public/data, with verdicts counted from now, like
// the club pages. Grouped so a deploy carries a few hundred files, not one per player (ADR 007).

/** Every player in the build, grouped by bucket. */
export async function playerBuckets(): Promise<Map<string, PlayerBucketFile>> {
  const [{ generatedAt }, ids] = await Promise.all([published.index(), listPlayerIds()]);
  const buckets = new Map<string, PlayerBucketFile>();
  for (const id of ids.sort()) {
    const profile: PlayerProfile | null = await published.player(id);
    if (!profile) continue;
    const bucket = playerBucket(id);
    let file = buckets.get(bucket);
    if (!file) {
      file = { generatedAt, players: {} };
      buckets.set(bucket, file);
    }
    file.players[id] = profile;
  }
  return buckets;
}

if (import.meta.main) {
  const dir = path.join(process.cwd(), 'public', PLAYER_DATA_DIR);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const buckets = await playerBuckets();
  let players = 0;
  for (const [bucket, file] of buckets) {
    writeFileSync(path.join(dir, `${bucket}.json`), JSON.stringify(file));
    players += Object.keys(file.players).length;
  }
  console.log(`Wrote ${players} players in ${buckets.size} files to public/${PLAYER_DATA_DIR}/.`);
}
