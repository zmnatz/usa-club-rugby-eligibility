import type { PublishedClubFile, PublishedFixturesFile, PublishedPlayersFile } from './data.ts';
import type { Club, EligibilityBreakdown, EligibilityRules, PlayerEligibility } from './types.ts';
import type { FeedFixture } from './feeds.ts';
import { clubBreakdown, clubFixtures, type ParticipationSnapshot } from './participation.ts';
import { buildPlayerIndex, clubContext, type PlayerClubEntry, type PlayerProfile, playerEntries, sortEntries } from './players.ts';
import { parseTeamSide, type TeamSide } from './teamSide.ts';

// Readers for the data the nightly job publishes: public/data/index.json,
// fixtures.json and clubs/<key>.json. Plain HTTPS GETs of static files, so there is
// no rate limit and no need for a key.

/** Where the reference deployment publishes its nightly data. */
export const DEFAULT_PUBLISHED_URL = 'https://zmnatz.github.io/usa-club-rugby-eligibility/data';

export interface PublishedClub extends Club {
  /** The club's page path and file name, e.g. "rocky-gorge". */
  key: string;
  /** Locked Seasons only: teams that look like this club's but have no division, so
   *  its players may have matches the verdicts don't count. */
  unplacedTeams?: string[];
}

/** A Locked Season as `seasons.json` lists it. */
export interface PublishedSeason {
  /** As the CMS names it, e.g. "2025/2026". */
  season: string;
  /** Its page path and directory, e.g. "2025-26". */
  slug: string;
  clubs: number;
  unplacedTeams: number;
}

/** A Locked Season's `seasons/<slug>/index.json`. */
export interface PublishedSeasonIndex {
  season: string;
  slug: string;
  clubs: PublishedClub[];
  unplacedTeams: string[];
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

export interface PublishedClientOptions {
  /** Directory URL holding index.json, fixtures.json and clubs/. */
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

export interface EligibilityOptions {
  rules?: EligibilityRules;
  /** The time possible remaining matches are counted from. Defaults to now. */
  now?: Date;
}

/** One club's per-side verdicts from its published participation. A pure function
 *  of its inputs, so the same data and rules always give the same verdicts. */
export function clubEligibility(
  snapshot: ParticipationSnapshot,
  fixtures: FeedFixture[],
  club: Club,
  options: EligibilityOptions = {},
): EligibilityBreakdown {
  return clubBreakdown(snapshot, clubFixtures(fixtures, club), club, options);
}

export function createPublishedClient({
  baseUrl = DEFAULT_PUBLISHED_URL,
  fetch: fetcher = globalThis.fetch,
}: PublishedClientOptions = {}) {
  const root = baseUrl.replace(/\/+$/, '');
  const cache = new Map<string, Promise<unknown>>();

  const getJson = <T>(file: string): Promise<T> => {
    let pending = cache.get(file) as Promise<T> | undefined;
    if (!pending) {
      pending = fetcher(`${root}/${file}`).then((response) => {
        if (!response.ok) throw new Error(`${root}/${file}: ${response.status}`);
        return response.json() as Promise<T>;
      });
      pending.catch(() => cache.delete(file));
      cache.set(file, pending);
    }
    return pending;
  };

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
     *  out from every club's file, so it reads them all. */
    async playerIndex(options: EligibilityOptions = {}): Promise<PublishedPlayersFile> {
      const [{ clubs, season }, all] = await Promise.all([index(), fixtures()]);
      const contexts = await Promise.all(
        clubs.map(async (published) => {
          const { snapshot } = await club(published.key);
          return { club: published, breakdown: clubContext(published, snapshot, all, options).breakdown };
        }),
      );
      return buildPlayerIndex(season, contexts);
    },
    /** A player from their CMS id: their verdict on every club side they're listed on, with
     *  the fixtures behind each. Null when the id isn't in the published record (players
     *  whose profile isn't public aren't). Reads every club to find them, so for many lookups
     *  build the index once with `playerIndex`. */
    async player(id: string, options: EligibilityOptions = {}): Promise<PlayerProfile | null> {
      const found = (await this.playerIndex(options)).players[id];
      if (!found) return null;
      const all = await fixtures();
      const entries: PlayerClubEntry[] = [];
      for (const key of found.clubs) {
        const { club: published, snapshot } = await club(key);
        entries.push(...playerEntries(id, clubContext(published, snapshot, all, options), options));
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
