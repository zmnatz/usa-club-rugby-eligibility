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
  lockedSeasonPlayerIndex,
  type ClubContext,
  type PlayerClubEntry,
  type PlayerProfile,
  type PlayerSeasonProfile,
  playerEntries,
  sortEntries,
} from './players.ts';
import { parseTeamSide, type TeamSide } from './teamSide.ts';

// The client for the data the nightly job publishes: public/data/index.json,
// fixtures.json, players.json, clubs/<key>.json, seasons.json, seasons/<slug>.json and
// seasons/<slug>.players.json. It reads them
// through a PublishedReader: over HTTPS by default (static files, so no rate limit and
// no key), from a directory with `fsReader` from "./node", or from memory in tests.

/** Where the reference deployment publishes its nightly data. */
export const DEFAULT_PUBLISHED_URL = 'https://usa-club-rugby-eligibility.netlify.app/data';

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
  /** When the archive was last pulled, which is when the data was calculated. */
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
  /** Directory URL holding index.json, fixtures.json, players.json and clubs/. */
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

  // Clubs' verdicts for the player lookups, worked out once per options object. With custom
  // options, finding which clubs a player is in needs all of them.
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
        // With no options the nightly job's own index answers, so no club is read to build
        // it. Data published before players.json existed has none, so it's worked out.
        if (options === NO_OPTIONS) {
          try {
            return await getJson<PublishedPlayersFile>('players.json');
          } catch (error) {
            if (!(error instanceof MissingPublishedFile)) throw error;
          }
        }
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

  // A Locked Season's players: which clubs each is in the record of. Read from the index
  // published beside the season's file, so a lookup reads only the seasons a player is in.
  // Data published before that index existed has none, so it's worked out from the file.
  const seasonPlayers = new Map<string, Promise<PublishedPlayersFile>>();
  function seasonIndex(slug: string): Promise<PublishedPlayersFile> {
    let pending = seasonPlayers.get(slug);
    if (!pending) {
      pending = getJson<PublishedPlayersFile>(`seasons/${slug}.players.json`).catch(async (error) => {
        if (!(error instanceof MissingPublishedFile)) throw error;
        return lockedSeasonPlayerIndex(await getJson<PublishedSeasonFile>(`seasons/${slug}.json`));
      });
      pending.catch(() => seasonPlayers.delete(slug));
      seasonPlayers.set(slug, pending);
    }
    return pending;
  }

  async function seasons(): Promise<PublishedSeason[]> {
    try {
      return (await getJson<PublishedSeasonsFile>('seasons.json')).seasons;
    } catch (error) {
      if (error instanceof MissingPublishedFile) return [];
      throw error;
    }
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
    seasons,
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
    /** Which clubs each player is in the record of, by CMS id. With no options it is the
     *  published `players.json`, so no club file is read. With options (custom rules or a
     *  `now`) it is worked out from every club's file under them, once per options object:
     *  calls with the same one share it, so pass a new one to count from a new `now`. */
    playerIndex,
    /** A player from their CMS id: their verdict on every club side they're listed on, with
     *  the fixtures behind each. Null when the id isn't in the published record (players
     *  whose profile isn't public aren't). With no options it finds them in `players.json`
     *  and reads only the clubs named there. With options the first lookup reads every club
     *  to find them; later ones with the same options object reuse what it worked out. */
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
    /** The CMS ids of every player in the record of a Locked Season, with the name it gives
     *  them. Reads each season's published player index, not its clubs. */
    async pastPlayerIds(): Promise<Record<string, { name: string }>> {
      const found: Record<string, { name: string }> = {};
      // Oldest first, so a player's latest name is the one kept.
      for (const { slug } of [...(await seasons())].reverse()) {
        for (const [id, { name }] of Object.entries((await seasonIndex(slug)).players)) found[id] = { name };
      }
      return found;
    },
    /** A player's verdicts in each Locked Season they're in the record of, newest season
     *  first: what `player` gives for the current one. Empty when they're in none. Reads each
     *  season's player index, then the file of only the seasons they're in. */
    async playerSeasons(id: string): Promise<PlayerSeasonProfile[]> {
      const profiles: PlayerSeasonProfile[] = [];
      for (const { slug } of await seasons()) {
        const found = (await seasonIndex(slug)).players[id];
        if (!found) continue;
        const file = await getJson<PublishedSeasonFile>(`seasons/${slug}.json`);
        const entries = found.clubs.flatMap((key) => {
          const club = file.clubs.find((item) => item.key === key);
          if (!club) throw new Error(`No club "${key}" in the ${file.season} season.`);
          return playerEntries(id, clubContext(club, file.clubFiles[key], file.fixtures));
        });
        profiles.push({ season: file.season, slug, name: found.name, clubs: sortEntries(entries) });
      }
      return profiles;
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
