import { describe, expect, it } from 'bun:test';
import { render, screen, within } from '@testing-library/react';
import { type PlayerEligibility, type PlayerRecordInput, type PlayerRow, playerFixtures } from '@zmnatz/usa-club-rugby-data';
import { EligibilityLinksProvider, type EligibilityRoutes } from './links.tsx';
import { PlayerDetailBody, PlayerDetailHeading } from './PlayerDetail.tsx';

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

  it("lists every game on the roster, marks one they didn't come on in, and omits the rest", () => {
    const fixture = (id: string, round: string, date: string) => ({
      ...record.fixtures[0],
      id,
      round,
      dateTime: date,
    });
    const rostered: PlayerRow = { ...row, rounds: { b1: 'Start', b2: 'R' } };
    const withUnused: PlayerRecordInput = {
      ...record,
      snapshot: { ...record.snapshot, resultIds: ['b1', 'b2', 'b3'], rows: [rostered] },
      fixtures: [
        record.fixtures[0],
        fixture('b2', 'Round 2', '2026-09-18T17:00:00Z'),
        fixture('b3', 'Round 3', '2026-09-25T17:00:00Z'),
      ],
    };
    const them = { ...player, rows: [rostered] };
    render(
      <EligibilityLinksProvider Link="a" routes={routes}>
        <PlayerDetailBody player={them} source="record" ownLabel="D3" fixtures={playerFixtures(them, withUnused)} />
      </EligibilityLinksProvider>,
    );
    expect(screen.getByText(/2 on the roster, 1 counted, 1 didn't come on/)).toBeTruthy();
    expect(screen.getByText("On the roster as a substitute, didn't come on")).toBeTruthy();
    expect(screen.getByText('Round 2')).toBeTruthy();
    expect(screen.queryByText('Round 3')).toBeNull();
    expect(screen.getByText('Not on the roster for 1 other fixture this season.')).toBeTruthy();
  });

  it("still lists a side the player was only ever an unused substitute for", () => {
    const only: PlayerRow = { ...row, rounds: { b1: 'R' } };
    const them = { ...player, rows: [only] };
    render(
      <EligibilityLinksProvider Link="a" routes={routes}>
        <PlayerDetailBody
          player={them}
          source="record"
          ownLabel="D3"
          fixtures={playerFixtures(them, { ...record, snapshot: { ...record.snapshot, rows: [only] } })}
        />
      </EligibilityLinksProvider>,
    );
    expect(screen.getByText("On the roster as a substitute, didn't come on")).toBeTruthy();
    expect(screen.queryByText(/Not on the roster this season for/)).toBeNull();
  });
});
