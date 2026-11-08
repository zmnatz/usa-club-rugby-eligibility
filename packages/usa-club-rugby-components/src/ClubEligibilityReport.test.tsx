import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fixture, NAMES, renderClubReport, SEASON } from './__fixtures__/report.tsx';

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

  it('shows the saved data while a live pull runs, then replaces it', async () => {
    let answer: (response: Response) => void = () => {};
    globalThis.fetch = (() => new Promise<Response>((resolve) => (answer = resolve))) as unknown as typeof fetch;

    await renderClubReport({ live: true, extraFixtures: [LIVE_GAME] });
    await openD3();
    expect(screen.getByText(/Nightly data/)).toBeTruthy();
    expect(within(rowOf(NAMES.onTrack)).getByText('ON TRACK')).toBeTruthy();

    await waitFor(() => expect(screen.getByText(/checking for newer matches/)).toBeTruthy());
    await waitFor(() => answer(matchResponse()));

    await waitFor(() => expect(screen.getByText(/Live data/)).toBeTruthy());
    expect(screen.getByText(new RegExp(SEASON))).toBeTruthy();
    expect(within(rowOf(NAMES.onTrack)).getByText('ELIGIBLE')).toBeTruthy();
  });

  it('keeps the saved data and says so when a live pull fails', async () => {
    globalThis.fetch = (async () => new Response('{}', { status: 400 })) as unknown as typeof fetch;

    await renderClubReport({ live: true, extraFixtures: [LIVE_GAME] });
    await openD3();

    expect(await screen.findByText(/The live pull failed/)).toBeTruthy();
    expect(screen.getByText(/Nightly data/)).toBeTruthy();
    expect(within(rowOf(NAMES.onTrack)).getByText('ON TRACK')).toBeTruthy();
  });

  it('makes no requests when not pulling live', async () => {
    let requests = 0;
    globalThis.fetch = (async () => {
      requests += 1;
      return new Response('{}');
    }) as unknown as typeof fetch;

    await renderClubReport();
    await openD3();
    await waitFor(() => expect(screen.queryByText(/checking for newer matches/)).toBeNull());
    expect(requests).toBe(0);
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
