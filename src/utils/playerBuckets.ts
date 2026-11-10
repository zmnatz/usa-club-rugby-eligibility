// Player data is published in a fixed number of grouped files rather than one page
// per player, so a deploy carries a few hundred files rather than tens of thousands
// (ADR 007). A player's file is chosen by a hash of their CMS id, which spreads
// players evenly whatever the ids look like. Safe in the browser and at build time.

import type { PlayerProfile } from '@zmnatz/usa-club-rugby-data';

/** How many files the players are spread over. Changing it moves every player. */
export const PLAYER_BUCKETS = 256;

/** The directory under the site root, and under `public/`, that holds them. */
export const PLAYER_DATA_DIR = 'player-data';

/** One bucket's file: the profiles of the players in it, by CMS id. */
export interface PlayerBucketFile {
  generatedAt: string;
  players: Record<string, PlayerProfile>;
}

/** The bucket a CMS id is in, as two hex digits: FNV-1a over its UTF-16 code units. */
export function playerBucket(id: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ((hash >>> 0) % PLAYER_BUCKETS).toString(16).padStart(2, '0');
}

/** A bucket's file path, relative to the site root. */
export const playerBucketFile = (bucket: string): string => `${PLAYER_DATA_DIR}/${bucket}.json`;
