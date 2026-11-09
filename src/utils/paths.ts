// Routes, relative to the site's base path (Next adds that).

export const clubPath = (clubKey: string): string => `/club/${clubKey}`;

/** A player's page is not under a club: they can play for several over time. */
export const playerPath = (playerId: string): string => `/player/${encodeURIComponent(playerId)}`;

/** A Locked Season's list of clubs, and a club's report for it. */
export const seasonPath = (slug: string): string => `/season/${slug}`;
export const seasonClubPath = (slug: string, clubKey: string): string => `${seasonPath(slug)}/club/${clubKey}`;

/** This site's pages, for the component package. */
export const routes = {
  club: clubPath,
  player: playerPath,
  methodology: () => '/methodology',
};
