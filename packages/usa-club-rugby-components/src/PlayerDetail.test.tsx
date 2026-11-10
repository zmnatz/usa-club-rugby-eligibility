import { describe, expect, it } from 'bun:test';
import { render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import type { PlayerEligibility, PlayerRecordInput, PlayerRow } from '@zmnatz/usa-club-rugby-data';
import { EligibilityLinksProvider, type EligibilityRoutes } from './links.tsx';
import { PlayerDetailBody, PlayerDetailHeading, PlayerEligibilityDialog } from './PlayerDetail.tsx';

const TEAM = 'Harbor City MD3';
const COMP = 'Test League Men D3';

const row: PlayerRow = {
  playerId: 'ona',
  firstName: 'Ona',
  lastName: 'Track',
  lastRegistered: '',
  teamName: TEAM,
  competition: COMP,
  appearances: 1,
  played: 1,
  substitute: 0,
  rounds: { b1: 'Start' },
};

const player: PlayerEligibility = {
  playerId: 'ona',
  firstName: 'Ona',
  lastName: 'Track',
  name: 'Ona Track',
  lastRegistered: '',
  teamName: TEAM,
  played: 1,
  substitute: 0,
  participation: 1,
  otherSides: [],
  rows: [row],
  eligible: true,
  reasons: [],
  pending: ['Needs 1 more D3 match (1 fixture left)'],
  cautions: [],
};

const record: PlayerRecordInput = {
  club: { sides: [{ label: 'D3', teamName: TEAM }] },
  snapshot: {
    season: '2026/2027',
    resultIds: ['b1'],
    gaps: [],
    rows: [row],
  },
  fixtures: [
    {
      id: 'b1',
      compId: 'c3',
      compName: COMP,
      season: '2026/2027',
      dateTime: '2026-09-11T17:00:00Z',
      round: 'Round 1',
      status: 'Result',
      sourceType: 'council',
      homeTeam: { name: TEAM, score: '20' },
      awayTeam: { name: 'Visitors MD3', score: '10' },
    },
    {
      id: 'b9',
      compId: 'c3',
      compName: COMP,
      season: '2026/2027',
      dateTime: '2099-05-01T17:00:00Z',
      round: 'Round 9',
      status: 'Scheduled',
      sourceType: 'council',
      homeTeam: { name: TEAM, score: '' },
      awayTeam: { name: 'Bayside MD3', score: '' },
    },
  ],
};

const routes: EligibilityRoutes = {
  club: (key) => `/teams/${key}`,
  player: (id) => `/player?id=${id}`,
  methodology: () => '/about',
};

const renderDialog = (theme = createTheme()) =>
  render(
    <ThemeProvider theme={theme}>
      <EligibilityLinksProvider Link="a" routes={routes}>
        <PlayerEligibilityDialog
          player={player}
          source="record"
          ownLabel="D3"
          record={record}
          pageHref={routes.player('ona')}
          onClose={() => {}}
        />
      </EligibilityLinksProvider>
    </ThemeProvider>,
  );

describe('PlayerEligibilityDialog', () => {
  it('shows the verdict, rounds and possible fixtures', () => {
    renderDialog();
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText('Ona Track')).toBeTruthy();
    expect(dialog.getByText('ON TRACK')).toBeTruthy();
    expect(dialog.getByText('Possible fixtures: 1 left')).toBeTruthy();
    expect(dialog.getByText('Started')).toBeTruthy();
  });

  it('links to the player page through the host Link and route', () => {
    renderDialog();
    expect(screen.getByRole('link', { name: 'Open as a page' }).getAttribute('href')).toBe('/player?id=ona');
  });

  it('shows nothing while no player is selected', () => {
    render(
      <EligibilityLinksProvider Link="a" routes={routes}>
        <PlayerEligibilityDialog player={null} source="record" ownLabel="D3" record={record} onClose={() => {}} />
      </EligibilityLinksProvider>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('under a host theme', () => {
  const hostTheme = createTheme({ palette: { text: { secondary: 'rgb(1, 2, 3)' } } });

  it("takes small print's colour from the host's palette", () => {
    render(
      <ThemeProvider theme={hostTheme}>
        <EligibilityLinksProvider Link="a" routes={routes}>
          <PlayerDetailBody player={player} source="record" ownLabel="D3" fixtures={null} />
        </EligibilityLinksProvider>
      </ThemeProvider>,
    );
    const note = screen.getByText('Needs 1 more D3 match (1 fixture left)');
    expect(getComputedStyle(note).color).toBe('rgb(1, 2, 3)');
  });

  it('renders the heading under the default theme with no ThemeProvider', () => {
    render(<PlayerDetailHeading player={player} source="csv" />);
    expect(screen.getByText('USA ID ona')).toBeTruthy();
  });
});
