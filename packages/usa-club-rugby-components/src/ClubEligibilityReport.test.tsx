import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PublishedClub } from '@zmnatz/usa-club-rugby-data';
import {
  club,
  fixture,
  fixtures,
  inHost,
  NAMES,
  renderClubReport,
  renderInHost,
  saved,
  SEASON,
} from './__fixtures__/report.tsx';
import { ClubEligibilityReport } from './ClubEligibilityReport.tsx';

const realFetch = globalThis.fetch;
let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
  globalThis.fetch = (async () => new Response('{"fixtures":[]}')) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const openD3 = async () => user.click(await screen.findByRole('tab', { name: 'D3 side' }));

/** The players down the table, top to bottom. */
const playerOrder = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent);

const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;

describe('verdicts', () => {
  it('shows an ineligible player with the reason', async () => {
    await renderClubReport();
    await openD3();
    const row = within(rowOf(NAMES.ineligible));
    expect(row.getByText('INELIGIBLE')).toBeTruthy();
    expect(row.getByText(/Played 4 D1 matches/)).toBeTruthy();
  });

  it('shows a cautioned player with the reason', async () => {
    await renderClubReport();
    await openD3();
    const row = within(rowOf(NAMES.caution));
    expect(row.getByText('CAUTION')).toBeTruthy();
    expect(row.getByText(/One more D1 match \(3 played\)/)).toBeTruthy();
  });

  it('shows an on-track player with what they still need', async () => {
    await renderClubReport();
    await openD3();
    const row = within(rowOf(NAMES.onTrack));
    expect(row.getByText('ON TRACK')).toBeTruthy();
    expect(row.getByText('Needs 1 more D3 match (1 fixture left)')).toBeTruthy();
  });

  it('shows an eligible player with nothing against them', async () => {
    await renderClubReport();
    await openD3();
    const row = within(rowOf(NAMES.eligible));
    expect(row.getByText('ELIGIBLE')).toBeTruthy();
    expect(row.getByText('—')).toBeTruthy();
  });
});

describe('filtering by status', () => {
  const filterBy = async (name: string) =>
    user.click(within(screen.getByRole('group', { name: 'Eligibility status' })).getByRole('button', { name }));

  it('narrows to ineligible players', async () => {
    await renderClubReport();
    await openD3();
    await filterBy('Ineligible');
    expect(playerOrder()).toEqual([NAMES.ineligible]);
    expect(screen.getByText('Showing 1 of 4')).toBeTruthy();
  });

  it('narrows to cautioned players', async () => {
    await renderClubReport();
    await openD3();
    await filterBy('Caution');
    expect(playerOrder()).toEqual([NAMES.caution]);
  });

  it('treats on-track and cautioned players as eligible', async () => {
    await renderClubReport();
    await openD3();
    await filterBy('Eligible');
    expect(playerOrder().sort()).toEqual([NAMES.caution, NAMES.eligible, NAMES.onTrack].sort());
  });

  it('shows everyone again on All', async () => {
    await renderClubReport();
    await openD3();
    await filterBy('Ineligible');
    await filterBy('All');
    expect(playerOrder()).toHaveLength(4);
  });
});

describe('sorting', () => {
  const sortBy = async (name: string) => user.click(screen.getByRole('button', { name }));

  it('starts by name', async () => {
    await renderClubReport();
    await openD3();
    expect(playerOrder()).toEqual([NAMES.caution, NAMES.eligible, NAMES.ineligible, NAMES.onTrack]);
  });

  it('reverses on a second click', async () => {
    await renderClubReport();
    await openD3();
    await sortBy('Player');
    expect(playerOrder()).toEqual([NAMES.onTrack, NAMES.ineligible, NAMES.eligible, NAMES.caution]);
  });

  it('ranks status Ineligible, Caution, On Track, Eligible', async () => {
    await renderClubReport();
    await openD3();
    await sortBy('Status');
    expect(playerOrder()).toEqual([NAMES.ineligible, NAMES.caution, NAMES.onTrack, NAMES.eligible]);
  });

  it("sorts by another side's participation", async () => {
    await renderClubReport();
    await openD3();
    await sortBy('D1 Participation');
    expect(playerOrder()).toEqual([NAMES.onTrack, NAMES.eligible, NAMES.caution, NAMES.ineligible]);
  });
});

describe('hiding columns', () => {
  // The open menu marks the page behind it hidden from assistive technology.
  const column = (name: string) => screen.queryByRole('columnheader', { name, hidden: true });

  it('removes a column and brings it back', async () => {
    await renderClubReport();
    await openD3();
    expect(column('Reason')).toBeTruthy();

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Reason' }));
    expect(column('Reason')).toBeNull();

    await user.click(screen.getByRole('option', { name: 'Reason' }));
    expect(column('Reason')).toBeTruthy();
  });

  it('adds a column hidden by default', async () => {
    await renderClubReport();
    await openD3();
    expect(column('Played')).toBeNull();

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Played' }));
    expect(column('Played')).toBeTruthy();
  });
});

describe('saved and live data', () => {
  const LIVE_GAME = fixture('l1', 'Harbor City MD3', '2026-10-05T17:00:00Z', { round: 'Round 4' });
  const NIGHTLY_STAMP = 'Records last updated Oct 1, 2026, 6:00 AM UTC';

  const lineup = (id: string, name: string) => ({
    id: `${id}__9`,
    name,
    position: 'Flanker',
    shirtNumber: '9',
    isHome: true,
  });

  const matchResponse = () =>
    new Response(
      JSON.stringify({
        data: {
          getFixtureItem: { ...LIVE_GAME, venue: 'Home Ground' },
          allMatchCommentary: [],
          allMatchStatsSummary: {
            lineUp: { players: [lineup('ona', NAMES.onTrack)], substitutes: [], coaches: [] },
          },
        },
      }),
    );

  const checkButton = () => screen.getByRole('button', { name: 'Check for newer matches' });

  /** Holds every CMS request open, for a test to answer. */
  const holdRequests = () => {
    const pending: ((response: Response) => void)[] = [];
    globalThis.fetch = (() => new Promise<Response>((resolve) => pending.push(resolve))) as unknown as typeof fetch;
    return pending;
  };

  const countRequests = () => {
    const seen = { requests: 0 };
    globalThis.fetch = (async () => {
      seen.requests += 1;
      return matchResponse();
    }) as unknown as typeof fetch;
    return seen;
  };

  it('shows when the saved records were last updated', async () => {
    await renderClubReport({ live: true });
    expect(screen.getByText(NIGHTLY_STAMP)).toBeTruthy();
    expect(screen.getByText(/Nightly data/)).toBeTruthy();
  });

  it('asks the CMS nothing until a visitor asks', async () => {
    const seen = countRequests();
    await renderClubReport({ live: true, extraFixtures: [LIVE_GAME] });
    await openD3();
    expect(within(rowOf(NAMES.onTrack)).getByText('ON TRACK')).toBeTruthy();
    expect(seen.requests).toBe(0);
  });

  it('offers no check when the host has not turned it on', async () => {
    await renderClubReport();
    expect(screen.queryByRole('button', { name: 'Check for newer matches' })).toBeNull();
  });

  it('keeps the saved data while a check runs, then replaces it and its timestamp', async () => {
    const pending = holdRequests();
    await renderClubReport({ live: true, extraFixtures: [LIVE_GAME] });
    await openD3();

    await user.click(checkButton());
    expect(screen.getByText(/checking for newer matches/)).toBeTruthy();
    expect((checkButton() as HTMLButtonElement).disabled).toBe(true);
    expect(within(rowOf(NAMES.onTrack)).getByText('ON TRACK')).toBeTruthy();

    await waitFor(() => expect(pending).toHaveLength(1));
    pending[0](matchResponse());

    await waitFor(() => expect(screen.getByText(/Live data/)).toBeTruthy());
    expect(screen.queryByText(NIGHTLY_STAMP)).toBeNull();
    expect(screen.getByText(/^Records last updated /)).toBeTruthy();
    expect(screen.getByText(new RegExp(SEASON))).toBeTruthy();
    expect(within(rowOf(NAMES.onTrack)).getByText('ELIGIBLE')).toBeTruthy();
  });

  it('keeps the saved data and says so when a check fails', async () => {
    globalThis.fetch = (async () => new Response('{}', { status: 400 })) as unknown as typeof fetch;

    await renderClubReport({ live: true, extraFixtures: [LIVE_GAME] });
    await openD3();
    await user.click(checkButton());

    expect(await screen.findByText(/The live pull failed/)).toBeTruthy();
    expect(screen.getByText(NIGHTLY_STAMP)).toBeTruthy();
    expect(within(rowOf(NAMES.onTrack)).getByText('ON TRACK')).toBeTruthy();
  });

  it('says so when there is nothing newer', async () => {
    const seen = countRequests();
    await renderClubReport({ live: true });
    await user.click(checkButton());

    expect(await screen.findByText(/no newer matches/)).toBeTruthy();
    expect(screen.getByText(NIGHTLY_STAMP)).toBeTruthy();
    expect(seen.requests).toBe(0);
  });

  it("doesn't carry one club's check to the next club", async () => {
    const pending = holdRequests();
    const other: PublishedClub = { key: 'other', name: 'Other Town', sides: club.sides };
    const report = (shown: PublishedClub) => (
      <ClubEligibilityReport club={shown} saved={saved} fixtures={[...fixtures, LIVE_GAME]} live />
    );

    const view = await renderInHost(report(club));
    await user.click(checkButton());
    await waitFor(() => expect(pending).toHaveLength(1));

    view.rerender(inHost(report(other)));
    await act(async () => {
      pending[0](matchResponse());
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(screen.getByText(/Nightly data/)).toBeTruthy();
    expect(screen.queryByText(/checking for newer matches/)).toBeNull();
    expect(screen.getByText(NIGHTLY_STAMP)).toBeTruthy();
  });
});

describe('player detail', () => {
  const openPlayer = async (name: string) => {
    await user.click(screen.getByText(name));
    return within(await screen.findByRole('dialog'));
  };

  it('opens from a row and shows the rounds behind the verdict', async () => {
    await renderClubReport();
    await openD3();
    const dialog = await openPlayer(NAMES.caution);

    expect(dialog.getByText('CAUTION')).toBeTruthy();
    expect(dialog.getByText(/One more D1 match \(3 played\)/)).toBeTruthy();
    expect(dialog.getByText('Harbor City MD1: 3 counted matches')).toBeTruthy();
    expect(dialog.getByText('Harbor City MD3: 3 counted matches')).toBeTruthy();
    expect(dialog.getAllByText('Started').length).toBe(6);
    expect(dialog.getAllByRole('link', { name: 'Rugby Xplorer' }).length).toBeGreaterThan(0);
  });

  it('shows the possible fixtures behind an on-track verdict', async () => {
    await renderClubReport();
    await openD3();
    const dialog = await openPlayer(NAMES.onTrack);

    expect(dialog.getByText('Possible fixtures: 1 left')).toBeTruthy();
    const possible = within(dialog.getByText('Possible fixtures: 1 left').parentElement as HTMLElement);
    expect(possible.getByText('Bayside MD3')).toBeTruthy();
  });

  it('shows no possible fixtures for a player already eligible', async () => {
    await renderClubReport();
    await openD3();
    const dialog = await openPlayer(NAMES.eligible);

    expect(dialog.queryByText(/Possible fixtures/)).toBeNull();
  });

  it('links to the player page', async () => {
    await renderClubReport();
    await openD3();
    const dialog = await openPlayer(NAMES.eligible);

    expect(dialog.getByRole('link', { name: 'Open as a page' }).getAttribute('href')).toBe('/player/eli');
  });

  it("uses the club's own Rugby Xplorer slug in match links when given", async () => {
    await renderClubReport({ clubSlug: 'harbor-city-rfc' });
    await openD3();
    const dialog = await openPlayer(NAMES.eligible);
    const links = dialog.getAllByRole('link', { name: 'Rugby Xplorer' });
    expect(links.every((link) => link.getAttribute('href')?.includes('/harbor-city-rfc/match-centre/'))).toBe(true);
  });

  it("falls back to the council's path without a slug", async () => {
    await renderClubReport();
    await openD3();
    const dialog = await openPlayer(NAMES.eligible);
    const links = dialog.getAllByRole('link', { name: 'Rugby Xplorer' });
    expect(links.some((link) => link.getAttribute('href')?.includes('/harbor-city-rfc/'))).toBe(false);
  });
});

describe('opening a player from the keyboard', () => {
  const playerButton = (name: string) => screen.getByRole('button', { name: new RegExp(name) });

  const tabTo = async (target: HTMLElement) => {
    for (let presses = 0; presses < 60 && document.activeElement !== target; presses++) await user.tab();
    expect(document.activeElement).toBe(target);
  };

  it('reaches every player with Tab', async () => {
    await renderClubReport();
    await openD3();
    for (const name of Object.values(NAMES)) await tabTo(playerButton(name));
  });

  it('tells assistive technology it opens the detail', async () => {
    await renderClubReport();
    await openD3();
    const button = screen.getByRole('button', { name: `${NAMES.caution}: open eligibility details` });
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('opens with Enter', async () => {
    await renderClubReport();
    await openD3();
    await tabTo(playerButton(NAMES.caution));
    await user.keyboard('{Enter}');
    expect(within(await screen.findByRole('dialog')).getByText('CAUTION')).toBeTruthy();
  });

  it('opens with Space', async () => {
    await renderClubReport();
    await openD3();
    await tabTo(playerButton(NAMES.eligible));
    await user.keyboard(' ');
    expect(within(await screen.findByRole('dialog')).getByText('ELIGIBLE')).toBeTruthy();
  });

  it('returns focus to the player when the dialog closes', async () => {
    await renderClubReport();
    await openD3();
    const button = playerButton(NAMES.onTrack);
    await tabTo(button);
    await user.keyboard('{Enter}');
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(button));
  });

  it('still opens from a click anywhere on the row', async () => {
    await renderClubReport();
    await openD3();
    await user.click(within(rowOf(NAMES.onTrack)).getByText('ON TRACK'));
    expect(within(await screen.findByRole('dialog')).getByText('Ona Track')).toBeTruthy();
  });
});
