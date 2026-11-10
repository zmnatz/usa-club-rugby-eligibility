import { describe, expect, it } from 'bun:test';
import type { EligibilityBreakdown, ParticipationGap, PlayerEligibility } from '@zmnatz/usa-club-rugby-data';
import {
  buildReport,
  CAUTION_ADVICE,
  filterPlayers,
  gapText,
  getColumns,
  sortPlayers,
  type SortKey,
} from './reportModel.ts';

const player = (name: string, overrides: Partial<PlayerEligibility> = {}): PlayerEligibility => {
  const [firstName, lastName] = name.split(' ');
  return {
    playerId: name.toLowerCase().replace(' ', '-'),
    firstName,
    lastName,
    name,
    lastRegistered: '',
    teamName: 'Harbor City MD1',
    played: 3,
    substitute: 1,
    participation: 4,
    otherSides: [],
    rows: [],
    eligible: true,
    reasons: [],
    pending: [],
    cautions: [],
    ...overrides,
  };
};

const eligible = player('Eli Clear');
const careful = player('Cal Careful', { cautions: ['one more D1 match ends D2 eligibility'], participation: 3 });
const onTrack = player('Ona Track', { pending: ['1 more match by Super Regionals'], participation: 1 });
const over = player('Ina Over', {
  eligible: false,
  reasons: ['Played 5 matches on D1'],
  participation: 5,
  otherSides: [{ label: 'D3', teamName: 'Harbor City MD3', participation: 2 }],
});
const players = [eligible, careful, onTrack, over];

const gap: ParticipationGap = {
  kind: 'no-lineup',
  fixtureId: 'a1',
  teamName: 'Harbor City MD1',
  opponent: 'Visitors MD1',
  competition: 'Test League Men D1',
  dateTime: '2026-09-05T17:00:00Z',
};

const breakdown = (sidePlayers: PlayerEligibility[]): EligibilityBreakdown => ({
  ignoredTeamNames: [],
  sides: [
    {
      label: 'D1',
      teamName: 'Harbor City MD1',
      players: sidePlayers,
      summary: {
        total: sidePlayers.length,
        eligible: sidePlayers.filter((p) => p.eligible).length,
        onTrack: 0,
        caution: sidePlayers.filter((p) => p.cautions.length > 0).length,
        competitions: ['Test League Men D1'],
      },
    },
  ],
});

const names = (list: PlayerEligibility[]) => list.map((p) => p.name);

describe('getColumns', () => {
  it('adds Last Registered only for a CSV report, and one column per other side', () => {
    expect(getColumns([], 'record').map((c) => c.key)).toEqual([
      'name', 'played', 'sub', 'participation', 'status', 'reasons',
    ]);
    expect(getColumns(['D3'], 'csv').map((c) => c.key)).toEqual([
      'name', 'lastRegistered', 'played', 'sub', 'participation', 'other:D3', 'status', 'reasons',
    ]);
  });
});

describe('sortPlayers', () => {
  it('sorts by name both ways without changing the input', () => {
    const input = [...players];
    expect(names(sortPlayers(input, 'name', 'asc'))).toEqual(['Cal Careful', 'Eli Clear', 'Ina Over', 'Ona Track']);
    expect(names(sortPlayers(input, 'name', 'desc'))).toEqual(['Ona Track', 'Ina Over', 'Eli Clear', 'Cal Careful']);
    expect(input).toEqual(players);
  });

  it.each<[SortKey, string[]]>([
    ['participation', ['Ona Track', 'Cal Careful', 'Eli Clear', 'Ina Over']],
    ['other:D3', ['Eli Clear', 'Cal Careful', 'Ona Track', 'Ina Over']],
    ['reasons', ['Eli Clear', 'Cal Careful', 'Ona Track', 'Ina Over']],
  ])('sorts by %s ascending', (key, expected) => {
    expect(names(sortPlayers(players, key, 'asc'))).toEqual(expected);
  });

  it('sorts by status rank, the most urgent verdict first', () => {
    expect(names(sortPlayers(players, 'status', 'asc'))).toEqual(['Ina Over', 'Cal Careful', 'Ona Track', 'Eli Clear']);
  });
});

describe('filterPlayers', () => {
  it('filters by status', () => {
    expect(names(filterPlayers(players, 'all'))).toHaveLength(4);
    expect(names(filterPlayers(players, 'eligible'))).toEqual(['Eli Clear', 'Cal Careful', 'Ona Track']);
    expect(names(filterPlayers(players, 'caution'))).toEqual(['Cal Careful']);
    expect(names(filterPlayers(players, 'ineligible'))).toEqual(['Ina Over']);
  });
});

describe('gapText', () => {
  it('names the match and the problem', () => {
    expect(gapText(gap)).toBe('Harbor City MD1 v Visitors MD1 (9/5/2026): no lineup recorded');
    expect(gapText({ ...gap, kind: 'no-substitutions' })).toContain('no substitutions recorded');
  });
});

describe('buildReport', () => {
  const now = new Date('2026-11-10T12:00:00Z');
  const meta = { title: 'Harbor City', source: 'record' as const, gaps: [] };

  it('lists eligible and ineligible players with their notes', () => {
    const text = buildReport(breakdown(players), { ...meta, season: '2026/2027', gaps: [gap] }, now);
    expect(text.split('\n')).toEqual([
      'HARBOR CITY ELIGIBILITY REPORT',
      `Generated: ${now.toLocaleString()}`,
      'Source: match record, 2026/2027 season',
      '',
      'RECORD GAPS (counts may be low; check these matches)',
      '  Harbor City MD1 v Visitors MD1 (9/5/2026): no lineup recorded',
      '',
      `CAUTION: ${CAUTION_ADVICE}`,
      '',
      '='.repeat(46),
      'D1 side — Test League Men D1',
      '='.repeat(46),
      '',
      'ELIGIBLE (3)',
      '  Eli Clear: played 3 / sub 1 (participation 4)',
      '  Cal Careful: played 3 / sub 1 (participation 3)',
      '    • Caution: one more D1 match ends D2 eligibility',
      '  Ona Track: played 3 / sub 1 (participation 1)',
      '    • On track: 1 more match by Super Regionals',
      '',
      'INELIGIBLE (1)',
      '  Ina Over: played 3 / sub 1 (participation 5), D3 participation 2',
      '    • Played 5 matches on D1',
      '',
    ]);
  });

  it('says (none) for an empty group and omits optional sections', () => {
    const text = buildReport(breakdown([eligible]), meta, now);
    expect(text).toContain('INELIGIBLE (0)\n  (none)');
    expect(text).not.toContain('RECORD GAPS');
    expect(text).not.toContain('CAUTION');
    expect(text).not.toContain('Source:');
  });

  it('shows USA IDs for a CSV report and CMS IDs for same-named players in a record report', () => {
    expect(buildReport(breakdown([eligible]), { ...meta, source: 'csv' }, now)).toContain('Eli Clear (#eli-clear):');
    const twins = [player('Sam Twin', { playerId: '1' }), player('Sam Twin', { playerId: '2' })];
    const text = buildReport(breakdown(twins), meta, now);
    expect(text).toContain('PLAYERS WITH THE SAME NAME');
    expect(text).toContain('  Sam Twin: CMS IDs 1, 2');
    expect(text).toContain('Sam Twin (CMS ID 1): played');
  });
});
