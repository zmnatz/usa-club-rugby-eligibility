import {
  buildPlayerIndex,
  clubContext,
  type ClubContext,
  type PlayerClubEntry,
  playerEntries,
  type PlayerProfile,
  sortEntries,
} from '@zmnatz/usa-club-rugby-data';
import { readClubSnapshot, readFixtures, readIndex } from '@/utils/published';

// What the player pages show, from the nightly data at build time. Which clubs a
// player is in isn't published; it's worked out here from the club files, and the same
// package functions the npm client uses work out their verdicts and fixtures. Never
// import this from code that runs in the browser.

const CACHE_KEY = '__playerPages';

interface Cache {
  players: ReturnType<typeof buildPlayerIndex>['players'];
  /** Each club's verdicts, by club key. */
  contexts: Map<string, ClubContext>;
}

/** Per build process, which every page asks. Every club's verdicts are worked out once
 *  here, since finding which clubs a player is in needs all of them. */
function cache(): Cache {
  const store = globalThis as unknown as Record<string, Cache | undefined>;
  if (!store[CACHE_KEY]) {
    const index = readIndex();
    const fixtures = readFixtures();
    const contexts = new Map(
      index.clubs.map((club) => [club.key, clubContext(club, readClubSnapshot(club.key), fixtures)] as const),
    );
    store[CACHE_KEY] = {
      players: buildPlayerIndex(
        index.season,
        [...contexts].map(([, { club, breakdown }]) => ({ club, breakdown })),
      ).players,
      contexts,
    };
  }
  return store[CACHE_KEY];
}

function context(key: string): ClubContext {
  const found = cache().contexts.get(key);
  if (!found) throw new Error(`No published club: ${key}`);
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
