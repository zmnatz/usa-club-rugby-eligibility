import type { OtherClubGames, PlayerClubEntry } from '@zmnatz/usa-club-rugby-data';
import { published } from './published';

// What a player's page shows, for getStaticProps: the seasons they're in the record of, as
// tabs, and one season's verdicts. Reads the published data from disk, so never import
// this from code that runs in the browser.

/** A season the player is in the record of: `slug` is null for the current season. */
export interface PlayerSeasonTab {
  season: string;
  slug: string | null;
}

/** A player's verdict in one club, with their games for the clubs they moved from. */
export interface PlayerSeasonEntry extends PlayerClubEntry {
  otherClubs: OtherClubGames[];
}

export interface PlayerPageProps {
  id: string;
  name: string;
  tabs: PlayerSeasonTab[];
  /** The season the page shows, and the player's verdict in each club in it. */
  shown: PlayerSeasonTab & { clubs: PlayerSeasonEntry[] };
}

/** A player's page for one Locked Season by its slug, or with `slug` null for the current
 *  season, or the newest they're in if they aren't in this season's record. Null when the
 *  id is in no player index (which includes Name Withheld players), or the player isn't in
 *  that Locked Season's record. */
export async function playerPage(id: string, slug: string | null): Promise<PlayerPageProps | null> {
  const [current, past, index] = await Promise.all([published.player(id), published.playerSeasons(id), published.index()]);
  const tabs: PlayerSeasonTab[] = [
    ...(current ? [{ season: index.season, slug: null }] : []),
    ...past.map(({ season, slug: pastSlug }) => ({ season, slug: pastSlug })),
  ];
  const name = current?.name ?? past[0]?.name;
  if (!name) return null;

  if (slug === null && current) {
    const clubs = await Promise.all(
      current.clubs.map(async (entry) => {
        const { snapshot } = await published.club(entry.clubKey);
        return { ...entry, otherClubs: snapshot.transfers?.[id] ?? [] };
      }),
    );
    return { id, name, tabs, shown: { season: index.season, slug: null, clubs } };
  }

  const season = slug === null ? past[0] : past.find((candidate) => candidate.slug === slug);
  if (!season) return null;
  const file = await published.season(season.slug);
  const clubs = season.clubs.map((entry) => ({
    ...entry,
    otherClubs: file.clubFiles[entry.clubKey]?.transfers?.[id] ?? [],
  }));
  return { id, name, tabs, shown: { season: season.season, slug: season.slug, clubs } };
}
