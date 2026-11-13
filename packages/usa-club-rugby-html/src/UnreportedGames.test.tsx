import { describe, expect, it } from 'bun:test';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { UnreportedGame } from '@zmnatz/usa-club-rugby-data';
import { EligibilityLinksProvider, type EligibilityRoutes } from './links.tsx';
import { UnreportedGames } from './UnreportedGames.tsx';

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
    expect(cells[0].textContent).toContain('6 days overdue');
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

  it("marks each row with its divisions and reasons for the stylesheet's filters", () => {
    renderGames([game]);
    const [, row] = screen.getAllByRole('row');
    expect(row.getAttribute('data-divisions')).toBe('M1 M2');
    expect(row.getAttribute('data-reasons')).toBe('no-lineup no-substitutions');
  });

  it('offers only the divisions and reasons the games have', () => {
    renderGames([game]);
    const division = screen.getByRole('group', { name: 'Division' });
    expect(within(division).getAllByRole('radio').map((radio) => (radio as HTMLInputElement).value)).toEqual([
      'all',
      'M1',
      'M2',
    ]);
    const reason = screen.getByRole('group', { name: 'Reason' });
    expect(within(reason).getAllByRole('radio').map((radio) => (radio as HTMLInputElement).value)).toEqual([
      'all',
      'no-lineup',
      'no-substitutions',
    ]);
  });

  it('counts the games the filters leave showing', () => {
    const noResult: UnreportedGame = {
      ...game,
      fixtureId: 'f2',
      divisions: ['W2'],
      reasons: [{ kind: 'no-result' }],
    };
    renderGames([game, noResult]);
    const heading = () => screen.getByRole('heading', { level: 2 }).textContent;
    expect(heading()).toBe('2 games');
    fireEvent.click(within(screen.getByRole('group', { name: 'Division' })).getByLabelText("Women's D2"));
    expect(heading()).toBe('1 of 2 games');
    fireEvent.click(within(screen.getByRole('group', { name: 'Reason' })).getByLabelText('No lineup'));
    expect(heading()).toBe('0 of 2 games');
    fireEvent.click(within(screen.getByRole('group', { name: 'Division' })).getByLabelText('All'));
    expect(heading()).toBe('1 of 2 games');
  });

  it('says so when no game is overdue', () => {
    renderGames([]);
    expect(screen.getByText('No games are overdue.')).toBeTruthy();
  });
});
