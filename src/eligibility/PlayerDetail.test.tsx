import { describe, expect, it } from 'bun:test';
import { render, screen, within } from '@testing-library/react';
import { type PlayerEligibility, type PlayerRecordInput, type PlayerRow, playerFixtures } from '@zmnatz/usa-club-rugby-data';
import { EligibilityLinksProvider, type EligibilityRoutes } from './links';
import { PlayerDetailBody, PlayerDetailHeading } from './PlayerDetail';

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

const renderBody = () =>
  render(
    <EligibilityLinksProvider Link="a" routes={routes}>
      <PlayerDetailHeading player={player} source="record" />
      <PlayerDetailBody player={player} source="record" ownLabel="D3" fixtures={playerFixtures(player, record)} />
    </EligibilityLinksProvider>,
  );

describe('PlayerDetailBody', () => {
  it('shows the verdict, rounds and possible fixtures', () => {
    renderBody();
    expect(screen.getByText('Ona Track')).toBeTruthy();
    expect(screen.getByText('ON TRACK')).toBeTruthy();
    expect(screen.getByText('Possible fixtures: 1 left')).toBeTruthy();
    expect(screen.getByText('Started')).toBeTruthy();
    expect(within(screen.getByText('Possible fixtures: 1 left').parentElement as HTMLElement).getByText('Bayside MD3')).toBeTruthy();
  });

  it("uses the club's own Rugby Xplorer slug in match links when given", () => {
    render(
      <PlayerDetailBody player={player} source="record" ownLabel="D3" fixtures={playerFixtures(player, record)} clubSlug="harbor-city-rfc" />,
    );
    const links = screen.getAllByRole('link', { name: 'Rugby Xplorer' });
    expect(links.every((link) => link.getAttribute('href')?.includes('/harbor-city-rfc/match-centre/'))).toBe(true);
  });

  it("falls back to the council's path without a slug", () => {
    renderBody();
    const links = screen.getAllByRole('link', { name: 'Rugby Xplorer' });
    expect(links.some((link) => link.getAttribute('href')?.includes('/harbor-city-rfc/'))).toBe(false);
  });

  it('renders the heading with no host setup beyond the stylesheet', () => {
    render(<PlayerDetailHeading player={player} source="csv" />);
    expect(screen.getByText('USA ID ona')).toBeTruthy();
  });
});
