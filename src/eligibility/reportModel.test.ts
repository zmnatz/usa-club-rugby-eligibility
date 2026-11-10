import { describe, expect, it } from 'bun:test';
import type { EligibilityBreakdown, ParticipationGap, PlayerEligibility } from '@zmnatz/usa-club-rugby-data';
import {
  buildReport,
  CAUTION_ADVICE,
  gapText,
  getColumns,
  sortsNumerically,
  sortValue,
  statusGroups,
  } from './reportModel';

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

describe('sortValue', () => {
  it('gives the value each column sorts by', () => {
    expect(sortValue(over, 'name')).toBe('Ina Over');
    expect(sortValue(over, 'participation')).toBe(5);
    expect(sortValue(over, 'played')).toBe(3);
    expect(sortValue(over, 'sub')).toBe(1);
    expect(sortValue(over, 'other:D3')).toBe(2);
    expect(sortValue(over, 'other:D9')).toBe(0);
    expect(sortValue(over, 'reasons')).toBe(1);
  });

  it('ranks status Ineligible, Caution, On Track, Eligible', () => {
    const ranks = [over, careful, onTrack, eligible].map((p) => sortValue(p, 'status') as number);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(4);
  });

  it('sorts names as text and everything else as numbers', () => {
    expect(sortsNumerically('name')).toBe(false);
    expect(sortsNumerically('lastRegistered')).toBe(false);
    expect(sortsNumerically('status')).toBe(true);
    expect(sortsNumerically('other:D3')).toBe(true);
  });
});

describe('statusGroups', () => {
  it('files a player under the status filters that show them', () => {
    expect(statusGroups(over)).toBe('ineligible');
    expect(statusGroups(careful)).toBe('eligible caution');
    expect(statusGroups(onTrack)).toBe('eligible');
    expect(statusGroups(eligible)).toBe('eligible');
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
      'Generated: Nov 10, 2026, 12:00 PM UTC',
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

  it('stamps a saved record with when it was last updated', () => {
    const text = buildReport(breakdown([eligible]), { ...meta, recordsUpdated: '2026-10-01T06:00:00Z' }, now);
    expect(text).toContain('Records last updated: Oct 1, 2026, 6:00 AM UTC');
    expect(text).not.toContain('Generated:');
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
