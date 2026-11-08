import type { ReactElement } from 'react';
import { act, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
  FeedFixture,
  ParticipationSnapshot,
  PlayerRow,
  PublishedClub,
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

/** Renders with a fresh query client and lets the first queries settle. */
export async function withQueryClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}>
      <EligibilityLinksProvider Link="a" routes={routes}>
        {ui}
      </EligibilityLinksProvider>
    </QueryClientProvider>);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  return view;
}

// Tests go through this, so only this file changes when the report's props do.

export const renderClubReport = ({
  live = false,
  extraFixtures = [] as FeedFixture[],
  clubSlug = undefined as string | undefined,
} = {}) =>
  withQueryClient(
    <ClubEligibilityReport
      club={club}
      saved={saved}
      fixtures={[...fixtures, ...extraFixtures]}
      live={live}
      clubSlug={clubSlug}
    />,
  );
