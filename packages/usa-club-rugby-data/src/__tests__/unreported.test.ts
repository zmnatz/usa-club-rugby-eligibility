import { describe, expect, it } from 'vitest';
import type { FeedFixture } from '../feeds.ts';
import type { PublishedClub } from '../published.ts';
import { DEFAULT_RULES } from '../rules.ts';
import type { ParticipationGap } from '../snapshot.ts';
import { competitionLabel, unreportedGames } from '../unreported.ts';

const KICKOFF = '2026-10-17T17:00:00Z';
const DAY = 24 * 60 * 60 * 1000;
/** `days` after kickoff. */
const daysAfter = (days: number) => new Date(new Date(KICKOFF).getTime() + days * DAY);

const fixture = (id: string, overrides: Partial<FeedFixture> = {}): FeedFixture => ({
  id,
  compId: 'c1',
  compName: 'MAC Men D1',
  season: '2026/2027',
  dateTime: KICKOFF,
  round: 'Round 4',
  status: 'Result',
  sourceType: '2',
  homeTeam: { name: 'Rocky Gorge MD1', score: '10' },
  awayTeam: { name: 'NOVA MD1', score: '5' },
  ...overrides,
});

const unplayed = (id: string, overrides: Partial<FeedFixture> = {}) =>
  fixture(id, {
    status: 'Fixture',
    homeTeam: { name: 'Rocky Gorge MD1', score: '' },
    awayTeam: { name: 'NOVA MD1', score: '' },
    ...overrides,
  });

const gap = (fixtureId: string, overrides: Partial<ParticipationGap> = {}): ParticipationGap => ({
  kind: 'no-lineup',
  fixtureId,
  teamName: 'Rocky Gorge MD1',
  opponent: 'NOVA MD1',
  competition: 'MAC Men D1',
  dateTime: KICKOFF,
  ...overrides,
});

const clubs: PublishedClub[] = [
  { key: 'rocky-gorge', name: 'Rocky Gorge', sides: [{ teamName: 'Rocky Gorge MD1', label: 'D1' }] },
  { key: 'nova', name: 'NOVA', sides: [{ teamName: 'NOVA MD1', label: 'D1' }] },
];

const run = (fixtures: FeedFixture[], gaps: ParticipationGap[] = [], now = daysAfter(20)) =>
  unreportedGames({ fixtures, gaps, clubs, rules: DEFAULT_RULES, now });

describe('unreportedGames', () => {
  it('lists a game with no result once more than 14 days have passed since kickoff', () => {
    expect(run([unplayed('f1')], [], daysAfter(14))).toEqual([]);
    expect(run([unplayed('f1')], [], daysAfter(14.5))).toEqual([
      {
        fixtureId: 'f1',
        dateTime: KICKOFF,
        daysOverdue: 1,
        competition: 'MAC Men D1',
        divisions: ['M1'],
        home: { teamName: 'Rocky Gorge MD1', clubKey: 'rocky-gorge', clubName: 'Rocky Gorge' },
        away: { teamName: 'NOVA MD1', clubKey: 'nova', clubName: 'NOVA' },
        reasons: [{ kind: 'no-result' }],
      },
    ]);
  });

  it('counts days overdue from the end of the 14 days', () => {
    expect(run([unplayed('f1')], [], daysAfter(20)).map((game) => game.daysOverdue)).toEqual([6]);
  });

  it('lists a side with no lineup, and both sides when both have gaps', () => {
    const games = run(
      [fixture('f1')],
      [gap('f1'), gap('f1', { kind: 'no-substitutions', teamName: 'NOVA MD1', opponent: 'Rocky Gorge MD1', rostered: 22 })],
    );
    expect(games.map((game) => game.reasons)).toEqual([
      [
        { kind: 'no-lineup', teamName: 'Rocky Gorge MD1' },
        { kind: 'no-substitutions', teamName: 'NOVA MD1' },
      ],
    ]);
  });

  it('flags no substitutions only when more than 15 were rostered', () => {
    const noSubs = (rostered: number) => gap('f1', { kind: 'no-substitutions', rostered });
    expect(run([fixture('f1')], [noSubs(15)])).toEqual([]);
    expect(run([fixture('f1')], [noSubs(16)]).map((game) => game.reasons)).toEqual([
      [{ kind: 'no-substitutions', teamName: 'Rocky Gorge MD1' }],
    ]);
  });

  it('lists a gap once even when two club files carry it', () => {
    expect(run([fixture('f1')], [gap('f1'), gap('f1')]).map((game) => game.reasons)).toEqual([
      [{ kind: 'no-lineup', teamName: 'Rocky Gorge MD1' }],
    ]);
  });

  it("leaves out a game that isn't a Qualifying Match", () => {
    expect(run([unplayed('f1', { compName: 'MAC Friendlies' })])).toEqual([]);
  });

  it('leaves out byes, and cancelled, postponed and forfeited games', () => {
    expect(
      run([
        unplayed('bye', { awayTeam: { name: '', score: '' } }),
        unplayed('cancelled', { status: 'Cancelled' }),
        unplayed('postponed', { status: 'Postponed' }),
        unplayed('forfeit', { status: 'Forfeit' }),
      ]),
    ).toEqual([]);
  });

  it('leaves out a forfeit even when a side has a gap', () => {
    expect(run([fixture('f1', { status: 'Forfeit', homeTeam: { name: 'Rocky Gorge MD1', score: '28' }, awayTeam: { name: 'NOVA MD1', score: '0' } })], [gap('f1')])).toEqual([]);
  });

  it("leaves out a game between teams that aren't any club's assessed side", () => {
    expect(
      run([unplayed('f1', { homeTeam: { name: 'Mad River MD4', score: '' }, awayTeam: { name: 'Boston MD4', score: '' } })]),
    ).toEqual([]);
  });

  it("names an unlisted opponent without a club, and gives each side's division", () => {
    const [game] = run([
      unplayed('f1', { awayTeam: { name: 'Chesapeake MD2', score: '' }, compName: 'MAC Men D1/D2' }),
    ]);
    expect(game.away).toEqual({ teamName: 'Chesapeake MD2', clubKey: null, clubName: 'Chesapeake' });
    expect(game.divisions).toEqual(['M1', 'M2']);
  });

  it('lists the most overdue first', () => {
    const games = run([unplayed('late', { dateTime: '2026-10-24T17:00:00Z' }), unplayed('early')], [], daysAfter(30));
    expect(games.map((game) => game.fixtureId)).toEqual(['early', 'late']);
  });
});

describe('competitionLabel', () => {
  it.each([
    ["2027 Midwest Men's D1 - Eastern", "Midwest Men's D1 - Eastern"],
    ['Georgia Rugby Union Matrix 2026 - 2027', 'Georgia Rugby Union Matrix'],
    ["RMRU Men's 2027 - D2", "RMRU Men's D2"],
    ['Capital Men 2026/27 D3', 'Capital Men D3'],
    ['PNW Womens D1/D2 Competitive ', 'PNW Womens D1/D2 Competitive'],
    ['MAC Men D1', 'MAC Men D1'],
  ])('reads %p as %p', (name, label) => {
    expect(competitionLabel(name)).toBe(label);
  });

  it('keeps a name that is only a year', () => {
    expect(competitionLabel('2027')).toBe('2027');
  });
});
