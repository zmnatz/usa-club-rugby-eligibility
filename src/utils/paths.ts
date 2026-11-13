// Routes, relative to the site's base path (Next adds that).

import type { EligibilityRoutes, ProblemReport } from '@zmnatz/usa-club-rugby-html';

export const clubPath = (clubKey: string): string => `/club/${clubKey}`;

/** A club's report with one player's detail open over it. */
export const clubPlayerPath = (clubKey: string, playerId: string): string =>
  `${clubPath(clubKey)}?player=${encodeURIComponent(playerId)}`;

/** A player's page is not under a club: they can play for several over time. */
export const playerPath = (playerId: string): string => `/player/${encodeURIComponent(playerId)}`;

/** A player's page with one season's tab open: `season` is a Locked Season's slug, or
 *  "current". With none, the newest season they're in. */
export const playerSeasonPath = (playerId: string, season: string): string =>
  `${playerPath(playerId)}?season=${encodeURIComponent(season)}`;

/** The season a page's URL has open, from its `season` query parameter. */
export const openSeason = (query: Record<string, string | string[] | undefined>): string | null =>
  typeof query.season === 'string' && query.season ? query.season : null;

/** The player a `/player/?id=<cms-id>` URL names, from while player pages were loaded
 *  in the browser (ADR 007), so it can be sent on. `pathname` is without the base path. */
export const queryPlayerId = (pathname: string, search: string): string | null =>
  /^\/player\/?$/.test(pathname) ? new URLSearchParams(search).get('id') || null : null;

/** A Locked Season's list of clubs, and a club's report for it. */
export const seasonPath = (slug: string): string => `/season?season=${encodeURIComponent(slug)}`;
export const seasonClubPath = (slug: string, clubKey: string): string =>
  `${seasonPath(slug)}&club=${encodeURIComponent(clubKey)}`;
export const seasonClubPlayerPath = (slug: string, clubKey: string, playerId: string): string =>
  `${seasonClubPath(slug, clubKey)}&player=${encodeURIComponent(playerId)}`;

/** The player a report's URL has open, from its `player` query parameter. */
export const openPlayer = (query: Record<string, string | string[] | undefined>): string | null =>
  typeof query.player === 'string' && query.player ? query.player : null;

/** A Locked Season's stats, built as a page of its own; with no season, every season's. */
export const statsPath = (slug: string): string => (slug ? `/stats/${slug}` : '/stats');

/** The site's code, and where people report a problem with it. */
export const REPO_URL = 'https://github.com/zmnatz/usa-club-rugby-eligibility';
export const ISSUES_URL = `${REPO_URL}/issues`;

const REPORT_PROMPT: Record<ProblemReport['kind'], string> = {
  'rules-engine': 'The record is right, but this verdict looks wrong under the season’s rules or team matching:',
  'archive-correction': 'The season’s archived record is wrong, or was corrected in Rugby Xplorer after it locked:',
};

/** Where to report a problem with a report. A Locked Season's report opens a new
 *  issue with its kind's label, and the season and club to reproduce it from the archive. */
export const reportProblemUrl = (report?: ProblemReport): string => {
  if (!report) return ISSUES_URL;
  const { kind, season, club } = report;
  const body = [
    // GitHub drops `labels` for reporters who can't triage, so the kind is in the body too.
    `Kind: ${kind}`,
    `Season: ${season}`,
    ...(club ? [`Club: ${club.name} (\`${club.key}\`)`] : []),
    '',
    REPORT_PROMPT[kind],
    '',
  ].join('\n');
  const params = new URLSearchParams({
    labels: kind,
    title: `${club ? `${club.name} ` : ''}${season}: `,
    body,
  });
  return `${ISSUES_URL}/new?${params}`;
};

/** This site's pages, for the component package. */
export const routes: EligibilityRoutes = {
  club: clubPath,
  player: playerPath,
  methodology: () => '/methodology',
  reportProblem: reportProblemUrl,
};
