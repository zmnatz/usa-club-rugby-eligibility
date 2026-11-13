import type { ReactElement } from 'react';
import { act, render } from '@testing-library/react';
import type {
  FeedFixture,
  ParticipationSnapshot,
  PlayerRow,
  PublishedClub,
  TransferRecords,
} from '@zmnatz/usa-club-rugby-data';
import { ClubEligibilityReport } from '../ClubEligibilityReport.tsx';
import { EligibilityLinksProvider, type EligibilityRoutes } from '../links.tsx';

// One fictional two-side club, with a player in each verdict on its D3 side.

export const SEASON = '2026/2027';
const D1 = 'Harbor City MD1';
const D3 = 'Harbor City MD3';
const D1_COMP = 'Test League Men D1';
const D3_COMP = 'Test League Men D3';

export const club: PublishedClub = {
  key: 'harbor-city',
  name: 'Harbor City',
  sides: [
    { label: 'D1', teamName: D1 },
    { label: 'D3', teamName: D3 },
  ],
};

export const fixture = (
  id: string,
  teamName: string,
  dateTime: string,
  overrides: Partial<FeedFixture> = {},
): FeedFixture => ({
  id,
  compId: teamName === D1 ? 'c1' : 'c3',
  compName: teamName === D1 ? D1_COMP : D3_COMP,
  season: SEASON,
  dateTime,
  round: `Round ${id.slice(1)}`,
  status: 'Result',
  sourceType: 'council',
  homeTeam: { name: teamName, score: '20' },
  awayTeam: { name: `Visitors ${teamName.slice(-3)}`, score: '10' },
  ...overrides,
});

const d1Games = ['a1', 'a2', 'a3', 'a4'];
const d3Games = ['b1', 'b2', 'b3'];

const played: FeedFixture[] = [
  ...d1Games.map((id, i) => fixture(id, D1, `2026-09-0${i + 1}T17:00:00Z`)),
  ...d3Games.map((id, i) => fixture(id, D3, `2026-09-1${i + 1}T17:00:00Z`)),
];

/** The fixture still to play, which keeps the On Track player on track. */
export const upcomingFixture = fixture('b9', D3, '2099-05-01T17:00:00Z', {
  round: 'Round 9',
  status: 'Scheduled',
  homeTeam: { name: D3, score: '' },
  awayTeam: { name: 'Bayside MD3', score: '' },
});

export const fixtures: FeedFixture[] = [...played, upcomingFixture];

function row(id: string, name: string, teamName: string, games: string[]): PlayerRow {
  const [firstName, lastName] = name.split(' ');
  return {
    playerId: id,
    firstName,
    lastName,
    lastRegistered: '',
    teamName,
    competition: teamName === D1 ? D1_COMP : D3_COMP,
    appearances: games.length,
    played: games.length,
    substitute: 0,
    rounds: Object.fromEntries(games.map((game) => [game, 'Start'])),
  };
}

export const saved: ParticipationSnapshot = {
  season: SEASON,
  generatedAt: '2026-10-01T06:00:00Z',
  resultIds: played.map((game) => game.id),
  gaps: [],
  rows: [
    row('ina', 'Ina Over', D1, d1Games),
    row('ina', 'Ina Over', D3, ['b1']),
    row('cal', 'Cal Careful', D1, d1Games.slice(0, 3)),
    row('cal', 'Cal Careful', D3, d3Games),
    row('ona', 'Ona Track', D3, ['b1']),
    row('eli', 'Eli Clear', D1, ['a1']),
    row('eli', 'Eli Clear', D3, d3Games),
  ],
};

export const NAMES = { ineligible: 'Ina Over', caution: 'Cal Careful', onTrack: 'Ona Track', eligible: 'Eli Clear' };

export const routes: EligibilityRoutes = {
  club: (key) => `/club/${key}`,
  player: (id) => `/player/${id}`,
  methodology: () => '/methodology',
};

/** The host's URL for a player's detail over the report. */
export const playerHref = (id: string) => `/club/harbor-city?player=${id}`;

/** Wraps a report in what a host supplies. */
export const inHost = (ui: ReactElement, hostRoutes: EligibilityRoutes = routes) => (
  <EligibilityLinksProvider Link="a" routes={hostRoutes}>
    {ui}
  </EligibilityLinksProvider>
);

/** Renders and lets the first load settle. */
export async function renderInHost(ui: ReactElement, hostRoutes: EligibilityRoutes = routes) {
  const view = render(inHost(ui, hostRoutes));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  return view;
}

// Tests go through this, so only this file changes when the report's props do.

export const renderClubReport = ({
  extraFixtures = [] as FeedFixture[],
  locked = false,
  unplacedTeams = undefined as string[] | undefined,
  notes = undefined as string[] | undefined,
  transfers = undefined as TransferRecords | undefined,
  reportProblem = undefined as EligibilityRoutes['reportProblem'],
  // The player the host's URL has open, and what it does to close them.
  playerId = null as string | null,
  onClose = (() => {}) as () => void,
} = {}) =>
  renderInHost(
    <ClubEligibilityReport
      club={{ ...club, ...(unplacedTeams ? { unplacedTeams } : {}), ...(notes ? { notes } : {}) }}
      saved={{ ...saved, ...(locked ? { locked } : {}), ...(transfers ? { transfers } : {}) }}
      fixtures={[...fixtures, ...extraFixtures]}
      playerId={playerId}
      playerHref={playerHref}
      onClose={onClose}
    />,
    reportProblem ? { ...routes, reportProblem } : routes,
  );

/** Eli Clear also played a match for Bayside. */
export const transfers: TransferRecords = {
  eli: [
    {
      clubKey: 'bayside',
      clubName: 'Bayside',
      sides: [
        {
          teamName: 'Bayside MD3',
          rounds: [
            {
              fixtureId: 'z1',
              round: 'Round 4',
              competition: 'Test League Men D3',
              dateTime: '2026-10-03T17:00:00Z',
              opponent: 'Harbor City MD3',
              scoreFor: '7',
              scoreAgainst: '12',
              status: 'started',
              counted: true,
              substitutionsMissing: false,
            },
          ],
        },
      ],
    },
  ],
};
