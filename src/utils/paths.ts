// Routes, relative to the site's base path (Next adds that).

export const clubPath = (clubKey: string): string => `/club/${clubKey}`;

/** A player's page is not under a club: they can play for several over time. */
export const playerPath = (playerId: string): string => `/player/${encodeURIComponent(playerId)}`;

/** A Locked Season's list of clubs, and a club's report for it. */
export const seasonPath = (slug: string): string => `/season?season=${encodeURIComponent(slug)}`;
export const seasonClubPath = (slug: string, clubKey: string): string =>
  `${seasonPath(slug)}&club=${encodeURIComponent(clubKey)}`;

/** A Locked Season's stats, built as a page of its own; with no season, every season's. */
export const statsPath = (slug: string): string => (slug ? `/stats/${slug}` : '/stats');

/** The site's code, and where people report a problem with it. */
export const REPO_URL = 'https://github.com/zmnatz/usa-club-rugby-eligibility';
export const ISSUES_URL = `${REPO_URL}/issues`;

/** This site's pages, for the component package. */
export const routes = {
  club: clubPath,
  player: playerPath,
  methodology: () => '/methodology',
};
