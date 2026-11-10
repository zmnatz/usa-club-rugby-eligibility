// Routes, relative to the site's base path (Next adds that).

import type { EligibilityRoutes, ProblemReport } from '@zmnatz/usa-club-rugby-components';

export const clubPath = (clubKey: string): string => `/club/${clubKey}`;

/** A player's page is not under a club: they can play for several over time. One page
 *  serves every player, chosen by the query (ADR 007). */
export const playerPath = (playerId: string): string => `/player?id=${encodeURIComponent(playerId)}`;

/** The player a pre-ADR 007 player URL, `/player/<cms-id>/`, names, so it can be sent on.
 *  `pathname` is without the base path. */
export const legacyPlayerId = (pathname: string): string | null => {
  const match = pathname.match(/^\/player\/([^/?#]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
};

/** A Locked Season's list of clubs, and a club's report for it. */
export const seasonPath = (slug: string): string => `/season?season=${encodeURIComponent(slug)}`;
export const seasonClubPath = (slug: string, clubKey: string): string =>
  `${seasonPath(slug)}&club=${encodeURIComponent(clubKey)}`;

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
