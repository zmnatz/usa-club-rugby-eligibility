import { describe, expect, it } from 'bun:test';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { UnreportedGame } from '@zmnatz/usa-club-rugby-data';
import { EligibilityLinksProvider, type EligibilityRoutes } from './links.tsx';
import { type UnreportedFilters, UnreportedGames } from './UnreportedGames.tsx';

const routes: EligibilityRoutes = {
  club: (key) => `/teams/${key}.html`,
  player: (id) => `/player?id=${id}`,
  methodology: () => '/about',
};

const game: UnreportedGame = {
  fixtureId: 'f1',
  dateTime: '2026-10-17T17:00:00Z',
  daysOverdue: 6,
  competition: 'MAC Men D1',
  divisions: ['M1', 'M2'],
  home: { teamName: 'Harbor City MD1', clubKey: 'harbor-city', clubName: 'Harbor City' },
  away: { teamName: 'Bayside MD2', clubKey: null, clubName: 'Bayside' },
  reasons: [
    { kind: 'no-lineup', teamName: 'Harbor City MD1' },
    { kind: 'no-substitutions', teamName: 'Bayside MD2' },
  ],
};

const renderGames = (games: UnreportedGame[]) =>
  render(
    <EligibilityLinksProvider Link="a" routes={routes}>
      <UnreportedGames games={games} />
    </EligibilityLinksProvider>,
  );

describe('UnreportedGames', () => {
  it("shows a game's date, overdue days, clubs, division and every reason", () => {
    renderGames([game]);
    const [, row] = screen.getAllByRole('row');
    const cells = within(row).getAllByRole('cell');
    expect(within(cells[1]).getByRole('link', { name: 'Harbor City' }).getAttribute('href')).toBe(
      '/teams/harbor-city.html',
    );
    expect(within(cells[2]).queryByRole('link')).toBeNull();
    expect(cells[2].textContent).toContain('Bayside MD2');
    expect(cells[3].textContent).toContain("Men's D1 / Men's D2");
    expect(cells[4].textContent).toContain('No lineup: Harbor City MD1');
    expect(cells[4].textContent).toContain('No substitutions: Bayside MD2');
  });

  it('emphasizes each side a gap names, and neither side for a missing result', () => {
    renderGames([
      { ...game, reasons: [{ kind: 'no-lineup', teamName: 'Bayside MD2' }] },
      { ...game, fixtureId: 'f2', reasons: [{ kind: 'no-result' }] },
    ]);
    const [, gap, noResult] = screen.getAllByRole('row');
    const flagged = (row: HTMLElement) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.classList.contains('ec-flagged'));
    expect(flagged(gap)).toEqual([false, false, true, false, false]);
    expect(flagged(noResult)).toEqual([false, false, false, false, false]);
  });

  it('groups games by division in collapsible sections, a cross-division game under the higher', () => {
    renderGames([game, { ...game, fixtureId: 'f2', divisions: ['W2'] }, { ...game, fixtureId: 'f3', divisions: [] }]);
    const groups = document.querySelectorAll('details');
    expect([...groups].map((group) => group.querySelector('summary')?.textContent)).toEqual([
      "Men's D1 (1 game)",
      "Women's D2 (1 game)",
      'Other (1 game)',
    ]);
    expect([...groups].every((group) => group.open)).toBe(true);
  });

  it('offers only the divisions and reasons the games have', () => {
    renderGames([game]);
    const division = screen.getByRole('combobox', { name: 'Division' });
    expect(within(division).getAllByRole('option').map((option) => (option as HTMLOptionElement).value)).toEqual([
      'all',
      'M1',
    ]);
    const reason = screen.getByRole('group', { name: 'Reason' });
    expect(within(reason).getAllByRole('radio').map((radio) => (radio as HTMLInputElement).value)).toEqual([
      'all',
      'no-lineup',
      'no-substitutions',
    ]);
  });

  it('filters by division and reason, and counts the games left', () => {
    const noResult: UnreportedGame = {
      ...game,
      fixtureId: 'f2',
      divisions: ['W2'],
      reasons: [{ kind: 'no-result' }],
    };
    renderGames([game, noResult]);
    const heading = () => screen.getByRole('heading', { level: 2 }).textContent;
    const rows = () => screen.queryAllByRole('row').length;
    const division = screen.getByRole('combobox', { name: 'Division' });
    expect(heading()).toBe('2 games');
    fireEvent.change(division, { target: { value: 'W2' } });
    expect(heading()).toBe('1 of 2 games');
    expect(rows()).toBe(2);
    fireEvent.click(within(screen.getByRole('group', { name: 'Reason' })).getByLabelText('No lineup'));
    expect(heading()).toBe('0 of 2 games');
    expect(screen.getByText('No games match these filters.')).toBeTruthy();
    fireEvent.change(division, { target: { value: 'all' } });
    expect(heading()).toBe('1 of 2 games');
  });

  it('takes its filters from the host, reads an unknown value as all, and reports changes', () => {
    const changes: UnreportedFilters[] = [];
    render(
      <EligibilityLinksProvider Link="a" routes={routes}>
        <UnreportedGames
          games={[game, { ...game, fixtureId: 'f2', divisions: ['W2'] }]}
          filters={{ division: 'W2', reason: 'nonsense' }}
          onFiltersChange={(next) => changes.push(next)}
        />
      </EligibilityLinksProvider>,
    );
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('1 of 2 games');
    expect((screen.getByLabelText('All') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText('No lineup'));
    expect(changes).toEqual([{ division: 'W2', reason: 'no-lineup' }]);
  });

  it('says so when no game is overdue', () => {
    renderGames([]);
    expect(screen.getByText('No games are overdue.')).toBeTruthy();
  });
});
