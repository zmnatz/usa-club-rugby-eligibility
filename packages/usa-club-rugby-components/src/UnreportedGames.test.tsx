import { describe, expect, it } from 'bun:test';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { UnreportedGame } from '@zmnatz/usa-club-rugby-data';
import { EligibilityLinksProvider, type EligibilityRoutes } from './links.tsx';
import { type UnreportedFilters, UnreportedGames } from './UnreportedGames.tsx';

// The same behaviour as the HTML package's list, through MUI's controls: the division is a
// select, the competition an Autocomplete, the reasons toggle buttons and the groups
// accordions. Colours are the theme's; each flagged cell carries its tone as `data-tone`.

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

const renderGames = (games: UnreportedGame[], props: Partial<Parameters<typeof UnreportedGames>[0]> = {}) =>
  render(
    <EligibilityLinksProvider Link="a" routes={routes}>
      <UnreportedGames games={games} {...props} />
    </EligibilityLinksProvider>,
  );

const heading = () => screen.getByRole('heading', { level: 2 }).textContent;
const reason = (name: string) => within(screen.getByRole('group', { name: 'Reasons' })).getByRole('button', { name });
const pressed = (name: string) => reason(name).getAttribute('aria-pressed') === 'true';
const bodyRows = () => screen.queryAllByRole('row').filter((row) => within(row).queryAllByRole('cell').length > 0);
const groupTitles = () => [...document.querySelectorAll('.MuiAccordionSummary-content')].map((title) => title.textContent);
const groupsOpen = () => [...document.querySelectorAll('.MuiAccordion-root')].map((group) => group.classList.contains('Mui-expanded'));

const chooseDivision = (name: string) => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Division' }));
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name }));
};
const typeCompetition = (value: string) =>
  fireEvent.change(screen.getByRole('combobox', { name: 'Competition' }), { target: { value } });

describe('UnreportedGames', () => {
  it("shows a game's date, clubs and every reason", () => {
    renderGames([game]);
    const [row] = bodyRows();
    const cells = within(row).getAllByRole('cell');
    expect(within(cells[1]).getByRole('link', { name: 'Harbor City' }).getAttribute('href')).toBe('/teams/harbor-city.html');
    expect(within(cells[1]).getByRole('link').getAttribute('title')).toBe('Harbor City MD1');
    expect(within(cells[2]).queryByRole('link')).toBeNull();
    expect(cells[2].textContent).toBe('Bayside');
    expect(within(cells[2]).getByTitle('Bayside MD2')).toBeTruthy();
    expect(cells).toHaveLength(4);
    expect(cells[3].textContent).toContain('No lineup: Harbor City MD1');
    expect(cells[3].textContent).toContain('No substitutions: Bayside MD2');
  });

  it('groups games by competition in collapsible sections, in name order without the year', () => {
    renderGames([{ ...game, competition: '2027 NERFU Men D2' }, { ...game, fixtureId: 'f2' }, { ...game, fixtureId: 'f3' }]);
    expect(groupTitles()).toEqual(['MAC Men D1 (2 games)', 'NERFU Men D2 (1 game)']);
    expect(groupsOpen()).toEqual([true, true]);
  });

  it('offers the divisions, competitions and reasons the games have', () => {
    renderGames([game, { ...game, fixtureId: 'f2', competition: 'Capital Men D3', divisions: ['M3'] }]);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Division' }));
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((option) => option.getAttribute('data-value'))).toEqual([
      'all',
      'M1',
      'M2',
      'M3',
    ]);
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Competition' }));
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Capital Men D3',
      'MAC Men D1',
    ]);
    expect(within(screen.getByRole('group', { name: 'Reasons' })).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'All',
      'No lineup',
      'No substitutions',
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
    expect(heading()).toBe('1 of 2 games');
    fireEvent.click(reason('No result'));
    expect(heading()).toBe('2 games');
    typeCompetition('capital');
    expect(heading()).toBe('1 of 2 games');
    expect(bodyRows()).toHaveLength(1);
    typeCompetition('');
    chooseDivision("Men's D2");
    expect(heading()).toBe('1 of 2 games');
    fireEvent.click(reason('No lineup'));
    expect(heading()).toBe('0 of 2 games');
    expect(screen.getByText('No games match these filters.')).toBeTruthy();
  });

  it('takes its filters from the host, reads an unknown division as all, and reports changes', () => {
    const changes: UnreportedFilters[] = [];
    renderGames([game, { ...game, fixtureId: 'f2', competition: 'Capital Women D2' }], {
      filters: { division: 'nonsense', competition: 'Capital', reasons: ['no-lineup', 'no-substitutions'] },
      onFiltersChange: (next) => changes.push(next),
    });
    expect(heading()).toBe('1 of 2 games');
    expect(screen.getByRole('combobox', { name: 'Division' }).textContent).toBe('All divisions');
    expect(pressed('No substitutions')).toBe(true);
    fireEvent.click(reason('No lineup'));
    expect(changes).toEqual([{ division: 'nonsense', competition: 'Capital', reasons: ['no-substitutions'] }]);
  });

  it('starts on games with no lineup, the gap that matters for eligibility', () => {
    renderGames([game, { ...game, fixtureId: 'f2', reasons: [{ kind: 'no-result' }] }]);
    expect(pressed('No lineup')).toBe(true);
    expect(pressed('No result')).toBe(false);
    expect(heading()).toBe('1 of 2 games');
  });

  it('turns each reason on and off on its own, showing a game when any of its reasons is on, and every game when none is', () => {
    const noSubs: UnreportedGame = { ...game, fixtureId: 'f2', reasons: [{ kind: 'no-substitutions', teamName: 'Bayside MD2' }] };
    const noResult: UnreportedGame = { ...game, fixtureId: 'f3', reasons: [{ kind: 'no-result' }] };
    renderGames([{ ...game, reasons: [{ kind: 'no-lineup', teamName: 'Harbor City MD1' }] }, noSubs, noResult]);
    fireEvent.click(reason('No result'));
    expect(heading()).toBe('2 of 3 games');
    fireEvent.click(reason('No lineup'));
    expect(heading()).toBe('1 of 3 games');
    fireEvent.click(reason('No substitutions'));
    expect(heading()).toBe('2 of 3 games');
    fireEvent.click(reason('No result'));
    fireEvent.click(reason('No substitutions'));
    expect(heading()).toBe('3 games');
    expect(pressed('All')).toBe(true);
  });

  it('clears every reason with All', () => {
    renderGames([game, { ...game, fixtureId: 'f2', reasons: [{ kind: 'no-result' }] }]);
    expect(pressed('All')).toBe(false);
    fireEvent.click(reason('All'));
    expect(pressed('All')).toBe(true);
    expect(pressed('No lineup')).toBe(false);
    expect(heading()).toBe('2 games');
  });

  it('expands and collapses every group at once', () => {
    renderGames([game, { ...game, fixtureId: 'f2', competition: 'Capital Men D3' }]);
    expect(groupsOpen()).toEqual([true, true]);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(groupsOpen()).toEqual([false, false]);
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(groupsOpen()).toEqual([true, true]);
  });

  it('lists every game in one table, naming its competition, without the grouping', () => {
    renderGames([game, { ...game, fixtureId: 'f2', competition: '2027 Capital Men D3' }]);
    fireEvent.click(screen.getByLabelText('Group by competition'));
    expect(groupTitles()).toHaveLength(0);
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
    const [first, second] = bodyRows();
    expect(within(first).getAllByRole('cell')[1].textContent).toBe('MAC Men D1');
    expect(within(second).getAllByRole('cell')[1].textContent).toBe('Capital Men D3');
  });

  it('colours each reason, its toggle and the side it names by the rule, the more serious gap winning', () => {
    renderGames([
      {
        ...game,
        reasons: [
          { kind: 'no-substitutions', teamName: 'Harbor City MD1' },
          { kind: 'no-lineup', teamName: 'Harbor City MD1' },
          { kind: 'no-substitutions', teamName: 'Bayside MD2' },
        ],
      },
      { ...game, fixtureId: 'f2', reasons: [{ kind: 'no-result' }] },
    ]);
    fireEvent.click(reason('All'));
    const [gaps, noResult] = bodyRows();
    const tones = (row: HTMLElement) => within(row).getAllByRole('cell').map((cell) => cell.getAttribute('data-tone'));
    expect(tones(gaps)).toEqual([null, 'error', 'warning', null]);
    expect(tones(noResult)).toEqual(['info', null, null, null]);
    expect(screen.getByText('No lineup: Harbor City MD1').getAttribute('data-tone')).toBe('error');
    expect(screen.getByText('No substitutions: Bayside MD2').getAttribute('data-tone')).toBe('warning');
    expect(screen.getByText('No result entered').getAttribute('data-tone')).toBe('info');
    expect(['No lineup', 'No substitutions', 'No result'].map((name) => reason(name).getAttribute('data-tone'))).toEqual([
      'error',
      'warning',
      'info',
    ]);
  });

  it('says so when no game is overdue', () => {
    renderGames([]);
    expect(screen.getByText('No games are overdue.')).toBeTruthy();
  });
});
