import type {
  PublishedClubFile,
  PublishedFixturesFile,
  PublishedPlayersFile,
  PublishedSeasonFile,
  PublishedSeasonsFile,
} from './data.ts';
import type { Club, EligibilityBreakdown, EligibilityRules, PlayerEligibility } from './types.ts';
import type { FeedFixture } from './feeds.ts';
import { clubSeason } from './clubSeason.ts';
import type { ParticipationSnapshot } from './snapshot.ts';
import {
  buildPlayerIndex,
  clubContext,
  type ClubContext,
  type PlayerClubEntry,
  type PlayerProfile,
  playerEntries,
  sortEntries,
} from './players.ts';
import { parseTeamSide, type TeamSide } from './teamSide.ts';

// The client for the data the nightly job publishes: public/data/index.json,
// fixtures.json, clubs/<key>.json, seasons.json and seasons/<slug>.json. It reads them
// through a PublishedReader: over HTTPS by default (static files, so no rate limit and
// no key), from a directory with `fsReader` from "./node", or from memory in tests.

/** Where the reference deployment publishes its nightly data. */
export const DEFAULT_PUBLISHED_URL = 'https://zmnatz.github.io/usa-club-rugby-eligibility/data';

export interface PublishedClub extends Club {
  /** The club's page path and file name, e.g. "rocky-gorge". */
  key: string;
  /** Locked Seasons only: teams that look like this club's but have no division, so
   *  its players may have matches the verdicts don't count. */
  unplacedTeams?: string[];
  /** Locked Seasons only: what was assumed about a team where the record doesn't say. */
  notes?: string[];
}

/** A Locked Season as `seasons.json` lists it. */
export interface PublishedSeason {
  /** As the CMS names it, e.g. "2025/2026". */
  season: string;
  /** Its page path and file name, e.g. "2025-26". */
  slug: string;
  clubs: number;
  unplacedTeams: number;
}

export interface PublishedIndex {
  /** When the published data last changed. */
  generatedAt: string;
  season: string;
  clubs: PublishedClub[];
}

/** A club's published file with the club it belongs to. */
export interface PublishedClubData {
  club: PublishedClub;
  snapshot: ParticipationSnapshot;
}

/** One team (side) of a club, flattened for listing. */
export interface TeamRecord {
  clubKey: string;
  clubName: string;
  teamName: string;
  /** The side's label within its club, e.g. "D1" or "D3 2nd XV". */
  label: string;
  /** Null when the name has no parseable division. */
  side: TeamSide | null;
}

/** A player's verdict on one side, with where it came from. */
export interface PlayerRecord extends PlayerEligibility {
  clubKey: string;
  clubName: string;
  /** The side's label within its club, e.g. "D1". */
  sideLabel: string;
}

/** Reads one published file by its path under the data directory, e.g. "clubs/nova.json",
 *  and resolves to its parsed JSON. Rejects with `MissingPublishedFile` when there is none. */
export type PublishedReader = (file: string) => Promise<unknown>;

/** A published file that isn't there, as opposed to one that couldn't be read. */
export class MissingPublishedFile extends Error {
  constructor(readonly file: string) {
    super(`No published file "${file}".`);
    this.name = 'MissingPublishedFile';
  }
}

export interface HttpReaderOptions {
  /** Directory URL holding index.json, fixtures.json and clubs/. */
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

/** Reads the published files over HTTP(S) from a directory URL. */
export function httpReader({
  baseUrl = DEFAULT_PUBLISHED_URL,
  fetch: fetcher = globalThis.fetch,
}: HttpReaderOptions = {}): PublishedReader {
  const root = baseUrl.replace(/\/+$/, '');
  return async (file) => {
    const response = await fetcher(`${root}/${file}`);
    if (response.status === 404) throw new MissingPublishedFile(file);
    if (!response.ok) throw new Error(`${root}/${file}: ${response.status}`);
    return response.json();
  };
}

/** Reads the published files from memory, by path. For tests, and for data already loaded. */
export function memoryReader(files: Record<string, unknown>): PublishedReader {
  return async (file) => {
    if (!Object.hasOwn(files, file)) throw new MissingPublishedFile(file);
    return files[file];
  };
}

export interface PublishedClientOptions extends HttpReaderOptions {
  /** Where the files are read from. Defaults to `httpReader` with `baseUrl` and `fetch`. */
  read?: PublishedReader;
}

export interface EligibilityOptions {
  rules?: EligibilityRules;
  /** The time possible remaining matches are counted from. Defaults to now. */
  now?: Date;
}

/** One club's per-side verdicts from its published participation. A pure function
 *  of its inputs, so the same data and rules always give the same verdicts.
 *  @deprecated Use `clubSeason(...).breakdown`. */
export function clubEligibility(
  snapshot: ParticipationSnapshot,
  fixtures: FeedFixture[],
  club: Club,
  options: EligibilityOptions = {},
): EligibilityBreakdown {
  return clubSeason(snapshot, fixtures, club, options).breakdown;
}

/** The options used when none are given, so calls without any share worked-out verdicts. */
const NO_OPTIONS: EligibilityOptions = {};

export function createPublishedClient({ read, ...http }: PublishedClientOptions = {}) {
  const reader = read ?? httpReader(http);
  const cache = new Map<string, Promise<unknown>>();

  const getJson = <T>(file: string): Promise<T> => {
    let pending = cache.get(file) as Promise<T> | undefined;
    if (!pending) {
      pending = reader(file) as Promise<T>;
      pending.catch(() => cache.delete(file));
      cache.set(file, pending);
    }
    return pending;
  };

  // Every club's verdicts for the player lookups, worked out once per options object, since
  // finding which clubs a player is in needs all of them.
  interface Worked {
    contexts: Map<string, Promise<ClubContext>>;
    index?: Promise<PublishedPlayersFile>;
  }
  const worked = new WeakMap<EligibilityOptions, Worked>();
  const workedFor = (options: EligibilityOptions): Worked => {
    const found = worked.get(options);
    if (found) return found;
    const fresh: Worked = { contexts: new Map() };
    worked.set(options, fresh);
    return fresh;
  };

  function contextFor(published: PublishedClub, options: EligibilityOptions): Promise<ClubContext> {
    const { contexts } = workedFor(options);
    let pending = contexts.get(published.key);
    if (!pending) {
      pending = Promise.all([getJson<PublishedClubFile>(`clubs/${published.key}.json`), fixtures()]).then(
        ([snapshot, all]) => clubContext(published, snapshot, all, options),
      );
      pending.catch(() => contexts.delete(published.key));
      contexts.set(published.key, pending);
    }
    return pending;
  }

  async function playerIndex(options: EligibilityOptions = NO_OPTIONS): Promise<PublishedPlayersFile> {
    const memo = workedFor(options);
    if (!memo.index) {
      memo.index = (async () => {
        const { clubs, season } = await index();
        const contexts = await Promise.all(clubs.map((published) => contextFor(published, options)));
        return buildPlayerIndex(season, contexts.map(({ club, breakdown }) => ({ club, breakdown })));
      })();
      memo.index.catch(() => {
        memo.index = undefined;
      });
    }
    return memo.index;
  }

  const index = () => getJson<PublishedIndex>('index.json');
  const fixtures = async () => (await getJson<PublishedFixturesFile>('fixtures.json')).fixtures;

  async function club(key: string): Promise<PublishedClubData> {
    const found = (await index()).clubs.find((item) => item.key === key);
    if (!found) throw new Error(`No club "${key}" in the published data.`);
    return { club: found, snapshot: await getJson<PublishedClubFile>(`clubs/${key}.json`) };
  }

  return {
    index,
    fixtures,
    club,
    /** The Locked Seasons published, newest first. None until the archive holds one. */
    async seasons(): Promise<PublishedSeason[]> {
      try {
        return (await getJson<PublishedSeasonsFile>('seasons.json')).seasons;
      } catch (error) {
        if (error instanceof MissingPublishedFile) return [];
        throw error;
      }
    },
    /** Everything published for one Locked Season, by its slug, e.g. "2024-25". */
    season: (slug: string) => getJson<PublishedSeasonFile>(`seasons/${slug}.json`),
    /** Every club published for the current season. */
    clubs: async (): Promise<PublishedClub[]> => (await index()).clubs,
    /** Every team (side) of every club. */
    async teams(): Promise<TeamRecord[]> {
      return (await index()).clubs.flatMap((item) =>
        item.sides.map((side) => ({
          clubKey: item.key,
          clubName: item.name,
          teamName: side.teamName,
          label: side.label,
          side: parseTeamSide(side.teamName),
        })),
      );
    },
    /** A club's verdicts side by side. */
    async eligibility(key: string, options: EligibilityOptions = {}): Promise<EligibilityBreakdown> {
      const [{ club: found, snapshot }, all] = await Promise.all([club(key), fixtures()]);
      return clubEligibility(snapshot, all, found, options);
    },
    /** Which clubs each player is in the record of, by CMS id. Not a published file: worked
     *  out from every club's file, so it reads them all. Worked out once per options object:
     *  calls with the same one (or none) share it, so pass a new one to count from a new `now`. */
    playerIndex,
    /** A player from their CMS id: their verdict on every club side they're listed on, with
     *  the fixtures behind each. Null when the id isn't in the published record (players
     *  whose profile isn't public aren't). The first lookup reads every club to find them;
     *  later ones with the same options object (or none) reuse what it worked out. */
    async player(id: string, options: EligibilityOptions = NO_OPTIONS): Promise<PlayerProfile | null> {
      const found = (await playerIndex(options)).players[id];
      if (!found) return null;
      const { clubs } = await index();
      const entries: PlayerClubEntry[] = [];
      for (const key of found.clubs) {
        const published = clubs.find((item) => item.key === key);
        if (!published) throw new Error(`No club "${key}" in the published data.`);
        entries.push(...playerEntries(id, await contextFor(published, options), options));
      }
      return { id, name: found.name, clubs: sortEntries(entries) };
    },
    /** Every player with a verdict on each of a club's sides, one record per side. */
    async players(key: string, options: EligibilityOptions = {}): Promise<PlayerRecord[]> {
      const [{ club: found, snapshot }, all] = await Promise.all([club(key), fixtures()]);
      const { sides } = clubEligibility(snapshot, all, found, options);
      return sides.flatMap((side) =>
        side.players.map((player) => ({ ...player, clubKey: found.key, clubName: found.name, sideLabel: side.label })),
      );
    },
  };
}

export type PublishedClient = ReturnType<typeof createPublishedClient>;
