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
  it("shows a game's date, clubs and every reason", () => {
    renderGames([game]);
    const [, row] = screen.getAllByRole('row');
    const cells = within(row).getAllByRole('cell');
    expect(within(cells[1]).getByRole('link', { name: 'Harbor City' }).getAttribute('href')).toBe(
      '/teams/harbor-city.html',
    );
    expect(within(cells[1]).getByRole('link').getAttribute('title')).toBe('Harbor City MD1');
    expect(within(cells[2]).queryByRole('link')).toBeNull();
    expect(cells[2].textContent).toBe('Bayside');
    expect(within(cells[2]).getByTitle('Bayside MD2')).toBeTruthy();
    expect(cells).toHaveLength(4);
    expect(cells[3].textContent).toContain('No lineup: Harbor City MD1');
    expect(cells[3].textContent).toContain('No substitutions: Bayside MD2');
  });

  it('emphasizes each side a gap names, and neither side for a missing result', () => {
    renderGames([
      { ...game, reasons: [{ kind: 'no-lineup', teamName: 'Bayside MD2' }] },
      { ...game, fixtureId: 'f2', reasons: [{ kind: 'no-result' }] },
    ]);
    fireEvent.click(screen.getByLabelText('No result'));
    const [, gap, noResult] = screen.getAllByRole('row');
    const flagged = (row: HTMLElement) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.classList.contains('ec-flagged'));
    expect(flagged(gap)).toEqual([false, false, true, false]);
    expect(flagged(noResult)).toEqual([false, false, false, false]);
  });

  it('groups games by competition in collapsible sections, in name order without the year', () => {
    renderGames([
      { ...game, competition: '2027 NERFU Men D2' },
      { ...game, fixtureId: 'f2' },
      { ...game, fixtureId: 'f3' },
    ]);
    const groups = document.querySelectorAll('details');
    expect([...groups].map((group) => group.querySelector('summary')?.textContent)).toEqual([
      'MAC Men D1 (2 games)',
      'NERFU Men D2 (1 game)',
    ]);
    expect([...groups].every((group) => group.open)).toBe(true);
  });

  it('offers the divisions, competitions and reasons the games have', () => {
    renderGames([game, { ...game, fixtureId: 'f2', competition: 'Capital Men D3', divisions: ['M3'] }]);
    const division = screen.getByRole('combobox', { name: 'Division' });
    expect(within(division).getAllByRole('option').map((option) => (option as HTMLOptionElement).value)).toEqual([
      'all',
      'M1',
      'M2',
      'M3',
    ]);
    const suggestions = document.getElementById('unreported-competitions') as HTMLDataListElement;
    expect([...suggestions.options].map((option) => option.value)).toEqual(['Capital Men D3', 'MAC Men D1']);
    expect(screen.getByRole('combobox', { name: 'Competition' }).getAttribute('list')).toBe('unreported-competitions');
    const reasons = screen.getByRole('group', { name: 'Reasons' });
    expect(within(reasons).getAllByRole('checkbox').map((box) => (box as HTMLInputElement).value)).toEqual([
      'all',
      'no-lineup',
      'no-substitutions',
    ]);
  });

  it('filters by division, by any part of a competition name, and by reasons, and counts the games left', () => {
    const noResult: UnreportedGame = {
      ...game,
      fixtureId: 'f2',
      competition: 'Capital Women D2',
      divisions: ['W2'],
      reasons: [{ kind: 'no-result' }],
    };
    renderGames([game, noResult]);
    const heading = () => screen.getByRole('heading', { level: 2 }).textContent;
    const rows = () => screen.queryAllByRole('row').length;
    const competition = screen.getByRole('combobox', { name: 'Competition' });
    expect(heading()).toBe('1 of 2 games');
    fireEvent.click(screen.getByLabelText('No result'));
    expect(heading()).toBe('2 games');
    fireEvent.change(competition, { target: { value: 'capital' } });
    expect(heading()).toBe('1 of 2 games');
    expect(rows()).toBe(2);
    fireEvent.change(competition, { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Division' }), { target: { value: 'M2' } });
    expect(heading()).toBe('1 of 2 games');
    fireEvent.click(screen.getByLabelText('No lineup'));
    expect(heading()).toBe('0 of 2 games');
    expect(screen.getByText('No games match these filters.')).toBeTruthy();
  });

  it('takes its filters from the host, reads an unknown division as all, and reports changes', () => {
    const changes: UnreportedFilters[] = [];
    render(
      <EligibilityLinksProvider Link="a" routes={routes}>
        <UnreportedGames
          games={[game, { ...game, fixtureId: 'f2', competition: 'Capital Women D2' }]}
          filters={{ division: 'nonsense', competition: 'Capital', reasons: ['no-lineup', 'no-substitutions'] }}
          onFiltersChange={(next) => changes.push(next)}
        />
      </EligibilityLinksProvider>,
    );
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('1 of 2 games');
    expect((screen.getByRole('combobox', { name: 'Division' }) as HTMLSelectElement).value).toBe('all');
    expect((screen.getByLabelText('No substitutions') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText('No lineup'));
    expect(changes).toEqual([{ division: 'nonsense', competition: 'Capital', reasons: ['no-substitutions'] }]);
  });

  it('starts on games with no lineup, the gap that matters for eligibility', () => {
    renderGames([game, { ...game, fixtureId: 'f2', reasons: [{ kind: 'no-result' }] }]);
    expect((screen.getByLabelText('No lineup') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('No result') as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('1 of 2 games');
  });

  it('turns each reason on and off on its own, showing a game when any of its reasons is on, and every game when none is', () => {
    const noSubs: UnreportedGame = { ...game, fixtureId: 'f2', reasons: [{ kind: 'no-substitutions', teamName: 'Bayside MD2' }] };
    const noResult: UnreportedGame = { ...game, fixtureId: 'f3', reasons: [{ kind: 'no-result' }] };
    renderGames([{ ...game, reasons: [{ kind: 'no-lineup', teamName: 'Harbor City MD1' }] }, noSubs, noResult]);
    const heading = () => screen.getByRole('heading', { level: 2 }).textContent;
    fireEvent.click(screen.getByLabelText('No result'));
    expect(heading()).toBe('2 of 3 games');
    fireEvent.click(screen.getByLabelText('No lineup'));
    expect(heading()).toBe('1 of 3 games');
    fireEvent.click(screen.getByLabelText('No substitutions'));
    expect(heading()).toBe('2 of 3 games');
    fireEvent.click(screen.getByLabelText('No result'));
    fireEvent.click(screen.getByLabelText('No substitutions'));
    expect(heading()).toBe('3 games');
    expect((screen.getByLabelText('All') as HTMLInputElement).checked).toBe(true);
  });

  it('clears every reason with All', () => {
    renderGames([game, { ...game, fixtureId: 'f2', reasons: [{ kind: 'no-result' }] }]);
    expect((screen.getByLabelText('All') as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByLabelText('All'));
    expect((screen.getByLabelText('All') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('No lineup') as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('2 games');
  });

  it("sizes every group's club columns to the longest club name in the list, filtered or not", () => {
    renderGames([
      game,
      { ...game, fixtureId: 'f2', competition: 'Capital Men D3', away: { ...game.away, clubName: 'Washington Renegades' } },
    ]);
    const section = screen.getByRole('region');
    expect(section.style.getPropertyValue('--ec-club-chars')).toBe('20');
    fireEvent.change(screen.getByRole('combobox', { name: 'Competition' }), { target: { value: 'MAC' } });
    expect(section.style.getPropertyValue('--ec-club-chars')).toBe('20');
    const cols = [...document.querySelectorAll('table col')].map((col) => col.className);
    expect(cols).toEqual(['ec-col-date', 'ec-col-club', 'ec-col-club', '']);
  });

  it('expands and collapses every group at once', () => {
    renderGames([game, { ...game, fixtureId: 'f2', competition: 'Capital Men D3' }]);
    const open = () => [...document.querySelectorAll('details')].map((group) => group.open);
    expect(open()).toEqual([true, true]);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(open()).toEqual([false, false]);
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(open()).toEqual([true, true]);
  });

  it('lists every game in one table, naming its competition, without the grouping', () => {
    renderGames([game, { ...game, fixtureId: 'f2', competition: '2027 Capital Men D3' }]);
    fireEvent.click(screen.getByLabelText('Group by competition'));
    expect(document.querySelectorAll('details')).toHaveLength(0);
    expect((screen.getByRole('button', { name: 'Expand all' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Collapse all' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Date',
      'Competition',
      'Home',
      'Away',
      'Reason',
    ]);
    const [, first, second] = screen.getAllByRole('row');
    expect(within(first).getAllByRole('cell')[1].textContent).toBe('MAC Men D1');
    expect(within(second).getAllByRole('cell')[1].textContent).toBe('Capital Men D3');
  });

  it('says so when no game is overdue', () => {
    renderGames([]);
    expect(screen.getByText('No games are overdue.')).toBeTruthy();
  });
});
