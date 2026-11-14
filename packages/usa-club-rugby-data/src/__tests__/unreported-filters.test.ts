import { describe, expect, it } from 'vitest';
import type { UnreportedGame } from '../unreported.ts';
import {
  DEFAULT_UNREPORTED,
  filterUnreported,
  toggleUnreportedReason,
  unreportedReasonText,
  unreportedSideTone,
} from '../unreportedFilters.ts';

const side = (clubName: string, teamName: string) => ({ teamName, clubKey: null, clubName });
const game = (id: string, competition: string, divisions: string[], reasons: UnreportedGame['reasons']): UnreportedGame => ({
  fixtureId: id,
  dateTime: '2026-10-01T15:00:00Z',
  daysOverdue: 3,
  competition,
  divisions,
  home: side('NOVA', 'NOVA MD3'),
  away: side('Potomac', 'Potomac MD3'),
  reasons,
});

const games = [
  game('a', '2027 Capital Men D3', ['M3'], [{ kind: 'no-lineup', teamName: 'NOVA MD3' }]),
  game('b', '2027 Capital Men D3', ['M3'], [{ kind: 'no-substitutions', teamName: 'Potomac MD3' }]),
  game('c', '2027 Midwest Women D1', ['W1'], [{ kind: 'no-result' }]),
];

describe('filterUnreported', () => {
  it('starts with the games with no lineup, and offers only what the games have', () => {
    const view = filterUnreported(games, DEFAULT_UNREPORTED);
    expect(view.shown.map((entry) => entry.fixtureId)).toEqual(['a']);
    expect(view.divisions.map(([code]) => code)).toEqual(['M3', 'W1']);
    expect(view.reasons.map(([kind]) => kind)).toEqual(['no-result', 'no-lineup', 'no-substitutions']);
    expect(view.competitions.map(({ label }) => label)).toEqual(['Capital Men D3', 'Midwest Women D1']);
  });

  it('shows every game when no reason is on, and filters by division and competition', () => {
    expect(filterUnreported(games, { ...DEFAULT_UNREPORTED, reasons: [] }).shown).toHaveLength(3);
    expect(filterUnreported(games, { division: 'W1', competition: '', reasons: [] }).shown.map((g) => g.fixtureId)).toEqual(['c']);
    expect(filterUnreported(games, { division: 'all', competition: 'capital', reasons: [] }).shown).toHaveLength(2);
  });

  it('reads a division the games do not offer as all', () => {
    const view = filterUnreported(games, { division: 'W2', competition: '', reasons: [] });
    expect(view.division).toBe('all');
    expect(view.shown).toHaveLength(3);
  });

  it('groups the shown games by competition, leaving out empty groups', () => {
    const view = filterUnreported(games, DEFAULT_UNREPORTED);
    expect(view.groups.map(({ label, games: grouped }) => [label, grouped.length])).toEqual([['Capital Men D3', 1]]);
  });
});

describe('the reasons', () => {
  it('toggles one reason, keeping the toggles in order', () => {
    expect(toggleUnreportedReason(['no-lineup'], 'no-result', true)).toEqual(['no-result', 'no-lineup']);
    expect(toggleUnreportedReason(['no-result', 'no-lineup'], 'no-lineup', false)).toEqual(['no-result']);
  });

  it('words each reason and marks the side with the most serious gap', () => {
    expect(unreportedReasonText({ kind: 'no-result' })).toBe('No result entered');
    expect(unreportedReasonText({ kind: 'no-lineup', teamName: 'NOVA MD3' })).toBe('No lineup: NOVA MD3');
    expect(unreportedSideTone(games[0], 'NOVA MD3')).toBe('error');
    expect(unreportedSideTone(games[0], 'Potomac MD3')).toBeNull();
    expect(unreportedSideTone(games[2], 'NOVA MD3')).toBeNull();
  });
});
