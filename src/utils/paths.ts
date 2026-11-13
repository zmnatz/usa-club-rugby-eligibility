// Routes, relative to the site's base path (Next adds that).

import type { EligibilityRoutes, ProblemReport } from '@zmnatz/usa-club-rugby-html';

export const clubPath = (clubKey: string): string => `/club/${clubKey}`;

/** A player's page is not under a club: they can play for several over time. It shows
 *  this season, or the newest they're in; a Locked Season they're in has a page of its own. */
export const playerPath = (playerId: string): string => `/player/${encodeURIComponent(playerId)}`;
export const playerSeasonPath = (playerId: string, slug: string): string =>
  `${playerPath(playerId)}/${encodeURIComponent(slug)}`;

/** The Locked Seasons published, a season's list of clubs, and a club's report for it. */
export const seasonsPath = '/season';
export const seasonPath = (slug: string): string => `${seasonsPath}/${encodeURIComponent(slug)}`;
export const seasonClubPath = (slug: string, clubKey: string): string =>
  `${seasonPath(slug)}/${encodeURIComponent(clubKey)}`;

/** Where a URL from before every page had a path of its own now lives, or null if it isn't
 *  one. They named the page by query: a Locked Season by `/season/?season=<slug>&club=<key>`
 *  (ADR 006), a player over a club report by `?player=<cms-id>`, a player page's season tab
 *  by `?season=<slug>`, and a player by `/player/?id=<cms-id>` (ADR 007). `pathname` is
 *  without the base path; the target has the trailing slash and no query. */
export const legacyRedirect = (pathname: string, search: string): string | null => {
  const query = new URLSearchParams(search);
  const param = (key: string) => query.get(key) || null;
  const page = (path: string) => `${path}/`;
  let parts: string[];
  try {
    parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    // A malformed escape names no page: leave it to the 404.
    return null;
  }
  const [route, first] = parts;
  const player = param('player');

  if (route === 'season' && parts.length === 1) {
    const slug = param('season');
    if (!slug) return null;
    const club = param('club');
    if (player) return page(playerSeasonPath(player, slug));
    return page(club ? seasonClubPath(slug, club) : seasonPath(slug));
  }
  if (route === 'season' && parts.length === 3 && player) return page(playerSeasonPath(player, first));
  if (route === 'club' && parts.length === 2 && player) return page(playerPath(player));
  if (route === 'player' && parts.length === 1) {
    const id = param('id');
    return id ? page(playerPath(id)) : null;
  }
  if (route === 'player' && parts.length === 2) {
    const season = param('season');
    if (!season) return null;
    return page(season === 'current' ? playerPath(first) : playerSeasonPath(first, season));
  }
  return null;
};

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
