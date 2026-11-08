import {
  clubContext,
  type ClubContext,
  type PlayerClubEntry,
  playerEntries,
  type PlayerProfile,
  sortEntries,
} from '@zmnatz/usa-club-rugby-data';
import { readClubSnapshot, readFixtures, readIndex, readPlayers } from '@/utils/published';

// What the player pages show, from the nightly data at build time: players.json says
// which clubs a player is in, and the same package functions the npm client uses
// work out their verdicts and fixtures. Never import this from code that runs in
// the browser.

const CACHE_KEY = '__playerPages';

interface Cache {
  players: ReturnType<typeof readPlayers>['players'];
  fixtures: ReturnType<typeof readFixtures>;
  clubs: Map<string, ReturnType<typeof readIndex>['clubs'][number]>;
  /** A club's verdicts, worked out the first time one of its players is asked for. */
  contexts: Map<string, ClubContext>;
}

/** Per build process, which every page asks. */
function cache(): Cache {
  const store = globalThis as unknown as Record<string, Cache | undefined>;
  store[CACHE_KEY] ??= {
    players: readPlayers().players,
    fixtures: readFixtures(),
    clubs: new Map(readIndex().clubs.map((club) => [club.key, club])),
    contexts: new Map(),
  };
  return store[CACHE_KEY];
}

function context(key: string): ClubContext {
  const { clubs, contexts, fixtures } = cache();
  let found = contexts.get(key);
  if (!found) {
    const club = clubs.get(key);
    if (!club) throw new Error(`players.json names a club that isn't published: ${key}`);
    found = clubContext(club, readClubSnapshot(key), fixtures);
    contexts.set(key, found);
  }
  return found;
}

export function listPlayerIds(): string[] {
  return Object.keys(cache().players);
}

/** A player and everything their page shows, or null if they have no page. */
export function readPlayerPage(id: string): PlayerProfile | null {
  const found = cache().players[id];
  if (!found) return null;
  const entries: PlayerClubEntry[] = found.clubs.flatMap((key) => playerEntries(id, context(key)));
  return { id, name: found.name, clubs: sortEntries(entries) };
}
