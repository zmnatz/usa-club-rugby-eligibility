import { beforeEach, describe, expect, it } from 'bun:test';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NAMES, renderClubReport, transfers } from './__fixtures__/report.tsx';
import { ENHANCEMENT_SCRIPT } from './enhance.ts';
import type { ProblemReport } from './links.tsx';
import { SkipToFirstPlayer } from './SkipToFirstPlayer.tsx';

// The host's one script, installed once on the page.
new Function(ENHANCEMENT_SCRIPT)();

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
});

/** One side's table section. Every side is on the page at once. */
const side = (name: string) => screen.getByRole('region', { name: new RegExp(`^${name} side`) });

/** The players down a side's table, top to bottom. */
const playerOrder = (name = 'D3') =>
  within(side(name))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent);

/** The row inside the D3 side, for a player who is on both sides. */
const d3Row = (name: string) => within(side('D3')).getByText(name).closest('tr') as HTMLElement;

describe('the sides', () => {
  it('shows every side, each with a link to jump to it', async () => {
    await renderClubReport();
    expect(side('D1')).toBeTruthy();
    expect(side('D3')).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Eligibility by division' });
    expect(within(nav).getByRole('link', { name: 'D3 side' }).getAttribute('href')).toBe('#side-1');
    expect(document.getElementById('side-1')).toBe(side('D3'));
  });
});

describe('verdicts', () => {
  it('shows an ineligible player with the reason', async () => {
    await renderClubReport();
    const row = within(d3Row(NAMES.ineligible));
    expect(row.getByText('INELIGIBLE')).toBeTruthy();
    expect(row.getByText(/Played 4 D1 matches/)).toBeTruthy();
  });

  it('shows a cautioned player with the reason', async () => {
    await renderClubReport();
    const row = within(d3Row(NAMES.caution));
    expect(row.getByText('CAUTION')).toBeTruthy();
    expect(row.getByText(/One more D1 match \(3 played\)/)).toBeTruthy();
  });

  it('shows an on-track player with what they still need', async () => {
    await renderClubReport();
    const row = within(d3Row(NAMES.onTrack));
    expect(row.getByText('ON TRACK')).toBeTruthy();
    expect(row.getByText('Needs 1 more D3 match (1 fixture left)')).toBeTruthy();
  });

  it('shows an eligible player with nothing against them', async () => {
    await renderClubReport();
    const row = within(d3Row(NAMES.eligible));
    expect(row.getByText('ELIGIBLE')).toBeTruthy();
    expect(row.getByText('—')).toBeTruthy();
  });
});

describe('filtering by status', () => {
  // The filter is CSS on the controls' state, which a test has no stylesheet to run.
  // So check what the CSS works from: a radio for each filter, and each row's groups.
  const groups = (name: string) => d3Row(name).getAttribute('data-groups')?.split(' ');

  it('offers all, eligible, caution and ineligible, starting on all', async () => {
    await renderClubReport();
    const filters = within(within(side('D3')).getByRole('group', { name: 'Eligibility status' }));
    expect(filters.getAllByRole('radio').map((radio) => (radio as HTMLInputElement).value)).toEqual([
      'all',
      'eligible',
      'caution',
      'ineligible',
    ]);
    expect((filters.getByRole('radio', { name: 'All' }) as HTMLInputElement).checked).toBe(true);
  });

  it('files each row under the filters that show it', async () => {
    await renderClubReport();
    expect(groups(NAMES.ineligible)).toEqual(['ineligible']);
    expect(groups(NAMES.caution)).toEqual(['eligible', 'caution']);
    // On-track and cautioned players are eligible.
    expect(groups(NAMES.onTrack)).toEqual(['eligible']);
    expect(groups(NAMES.eligible)).toEqual(['eligible']);
  });

  it('keeps each side’s filter separate', async () => {
    await renderClubReport();
    const names = [...document.querySelectorAll('input[type="radio"]')].map((radio) => (radio as HTMLInputElement).name);
    expect(new Set(names)).toEqual(new Set(['status-0', 'status-1']));
  });

  it('shows the side’s totals', async () => {
    await renderClubReport();
    expect(within(side('D3')).getByText(/of 4 eligible/)).toBeTruthy();
  });
});

describe('sorting', () => {
  const sortBy = async (name: string) => user.click(within(side('D3')).getByRole('button', { name }));

  it('starts by name', async () => {
    await renderClubReport();
    expect(playerOrder()).toEqual([NAMES.caution, NAMES.eligible, NAMES.ineligible, NAMES.onTrack]);
  });

  it('reverses on a second click', async () => {
    await renderClubReport();
    await sortBy('Player');
    expect(playerOrder()).toEqual([NAMES.onTrack, NAMES.ineligible, NAMES.eligible, NAMES.caution]);
  });

  it('ranks status Ineligible, Caution, On Track, Eligible', async () => {
    await renderClubReport();
    await sortBy('Status');
    expect(playerOrder()).toEqual([NAMES.ineligible, NAMES.caution, NAMES.onTrack, NAMES.eligible]);
  });

  it("sorts by another side's participation", async () => {
    await renderClubReport();
    await sortBy('D1 Participation');
    expect(playerOrder()).toEqual([NAMES.onTrack, NAMES.eligible, NAMES.caution, NAMES.ineligible]);
  });

  it('marks the sorted column', async () => {
    await renderClubReport();
    await sortBy('Status');
    expect(within(side('D3')).getByRole('columnheader', { name: 'Status' }).getAttribute('aria-sort')).toBe('ascending');
    expect(within(side('D3')).getByRole('columnheader', { name: 'Player' }).getAttribute('aria-sort')).toBeNull();
  });

  it('leaves the other side alone', async () => {
    await renderClubReport();
    const before = playerOrder('D1');
    await sortBy('Status');
    expect(playerOrder('D1')).toEqual(before);
  });
});

describe('columns', () => {
  // As with the filter, the CSS hides a column from its checkbox; check the markup it uses.
  const header = (name: string) => within(side('D3')).queryByRole('columnheader', { name, hidden: true });

  it('lets Played, Sub and nothing else be turned on', async () => {
    await renderClubReport();
    const checkboxes = within(side('D3')).getAllByRole('checkbox', { hidden: true });
    expect(checkboxes.map((box) => box.getAttribute('data-col'))).toEqual(['played', 'sub']);
    expect(checkboxes.every((box) => !(box as HTMLInputElement).checked)).toBe(true);
  });

  it('marks the optional columns so the CSS can hide them', async () => {
    await renderClubReport();
    expect(header('Played')?.className).toContain('col-played');
    expect(header('Reason')?.className ?? '').not.toContain('col-');
  });
});

describe('the saved records', () => {
  it('shows when they were last updated', async () => {
    await renderClubReport();
    expect(screen.getByText('Records last updated Oct 1, 2026, 6:00 AM UTC')).toBeTruthy();
    expect(screen.getByText(/Nightly data/)).toBeTruthy();
  });

  it('asks the CMS nothing', async () => {
    const realFetch = globalThis.fetch;
    let requests = 0;
    globalThis.fetch = (async () => {
      requests += 1;
      return new Response('{}');
    }) as unknown as typeof fetch;
    try {
      await renderClubReport();
      expect(requests).toBe(0);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe('players', () => {
  it('links each player to their own page', async () => {
    await renderClubReport();
    expect(within(d3Row(NAMES.eligible)).getByRole('link', { name: NAMES.eligible }).getAttribute('href')).toBe('/player/eli');
  });

  it('opens no dialog: the report has nothing to open', async () => {
    await renderClubReport();
    await user.click(within(d3Row(NAMES.caution)).getByRole('link', { name: NAMES.caution }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('reaches every player with Tab', async () => {
    await renderClubReport();
    const link = within(d3Row(NAMES.onTrack)).getByRole('link', { name: NAMES.onTrack });
    for (let presses = 0; presses < 80 && document.activeElement !== link; presses++) await user.tab();
    expect(document.activeElement).toBe(link);
  });
});

describe('the exported report', () => {
  const exported = () => document.querySelector('template[data-export-report]') as HTMLTemplateElement;

  it('is written into the page, from the records’ own time', async () => {
    await renderClubReport();
    const text = exported().content.textContent || exported().textContent;
    expect(text).toContain('HARBOR CITY ELIGIBILITY REPORT');
    expect(text).toContain('Records last updated: Oct 1, 2026, 6:00 AM UTC');
    expect(text).toContain(`  ${NAMES.eligible}: played`);
    expect(exported().getAttribute('data-export-report')).toBe('eligibility-report-2026-10-01.txt');
  });

  it('downloads that text from the button', async () => {
    const urls: Blob[] = [];
    const realCreate = URL.createObjectURL;
    URL.createObjectURL = ((blob: Blob) => {
      urls.push(blob);
      return 'blob:test';
    }) as typeof URL.createObjectURL;
    const realRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = () => {};
    const realClick = HTMLAnchorElement.prototype.click;
    let downloaded = '';
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      downloaded = this.download;
    };
    try {
      await renderClubReport();
      await user.click(screen.getByRole('button', { name: 'Export Report' }));
      expect(downloaded).toBe('eligibility-report-2026-10-01.txt');
      expect(await urls[0].text()).toContain('HARBOR CITY ELIGIBILITY REPORT');
    } finally {
      URL.createObjectURL = realCreate;
      URL.revokeObjectURL = realRevoke;
      HTMLAnchorElement.prototype.click = realClick;
    }
  });
});

describe('skipping to the first player', () => {
  it('links to the first row of the first side, which can take focus', async () => {
    await renderClubReport();
    const { getByRole } = render(<SkipToFirstPlayer />);
    const target = document.getElementById(getByRole('link', { name: 'Skip to first player' }).getAttribute('href')?.slice(1) ?? '');
    expect(target?.tagName).toBe('TR');
    expect(target?.tabIndex).toBe(-1);
    expect(side('D1').contains(target)).toBe(true);
  });

  it('follows the table when it is sorted', async () => {
    await renderClubReport();
    await user.click(within(side('D1')).getByRole('button', { name: 'Player' }));
    const [first] = playerOrder('D1');
    expect(document.getElementById('first-player')?.textContent).toContain(first as string);
    expect(document.querySelectorAll('#first-player')).toHaveLength(1);
  });
});

describe('a Locked Season', () => {
  it('gives only eligible or ineligible', async () => {
    await renderClubReport({ locked: true });
    expect(within(d3Row(NAMES.caution)).getByText('ELIGIBLE')).toBeTruthy();
    expect(within(d3Row(NAMES.onTrack)).getByText('INELIGIBLE')).toBeTruthy();
    expect(within(d3Row(NAMES.onTrack)).getByText('Needs 2 D3 matches (has 1)')).toBeTruthy();
  });

  it('has no Caution filter or talk of fixtures to come', async () => {
    await renderClubReport({ locked: true });
    const filters = within(within(side('D3')).getByRole('group', { name: 'Eligibility status' }));
    expect(filters.queryByRole('radio', { name: 'Caution' })).toBeNull();
    expect(screen.queryByText(/on track/i)).toBeNull();
    expect(screen.queryByText(/caution/i)).toBeNull();
    expect(screen.getByText(/final/i)).toBeTruthy();
  });

  it('has no player pages to link to', async () => {
    await renderClubReport({ locked: true });
    expect(within(d3Row(NAMES.eligible)).queryByRole('link')).toBeNull();
  });

  it('warns when a team that looks like the club\'s has no division', async () => {
    await renderClubReport({ locked: true, unplacedTeams: ['Harbor City Men Senior'] });
    expect(screen.getByText(/Harbor City Men Senior/)).toBeTruthy();
  });

  it('explains the rules of its season', async () => {
    await renderClubReport({ locked: true });
    expect(screen.getByRole('heading', { name: 'The 2026/2027 rules' })).toBeTruthy();
    expect(screen.getByText('A 4th match for any one upper side loses the sides below it.')).toBeTruthy();
  });

  it('says what was assumed about a team where the record doesn\'t say', async () => {
    const note = 'Harbor City 2nd XV: the record doesn\'t name its division, so as a second side it is taken as D3.';
    await renderClubReport({ locked: true, notes: [note] });
    expect(screen.getByText(note)).toBeTruthy();
  });

  it('keeps the current season\'s report as it was', async () => {
    await renderClubReport();
    expect(screen.queryByRole('heading', { name: /rules/ })).toBeNull();
    expect(within(side('D3')).getByRole('group', { name: 'Eligibility status' })).toBeTruthy();
    expect(screen.queryByText(/final/i)).toBeNull();
  });
});

describe('a player who played for another club', () => {
  it('is marked as needing a waiver, and no one else is', async () => {
    await renderClubReport({ transfers });
    expect(within(d3Row(NAMES.eligible)).getByText('Waiver Required')).toBeTruthy();
    expect(within(d3Row(NAMES.caution)).queryByText('Waiver Required')).toBeNull();
  });
});

describe('reporting a problem', () => {
  const reportProblem = (report?: ProblemReport) =>
    report ? `/report/${report.kind}/${report.season}/${report.club?.key ?? ''}` : '/report';

  it('sends this season’s problems to Rugby Xplorer first, then to the host', async () => {
    await renderClubReport({ reportProblem });
    expect(screen.getByText(/check and correct it in Rugby Xplorer first/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'report it' }).getAttribute('href')).toBe('/report');
  });

  it('shows no note when the host gives nowhere to report', async () => {
    await renderClubReport();
    expect(screen.queryByText(/check and correct it in Rugby Xplorer first/)).toBeNull();
  });

  it('asks about a Locked Season’s rules and record, since Rugby Xplorer no longer changes it', async () => {
    await renderClubReport({ reportProblem, locked: true });
    expect(screen.queryByText(/check and correct it in Rugby Xplorer first/)).toBeNull();
    expect(screen.getByText(/correcting Rugby Xplorer won’t change them/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Report a verdict' }).getAttribute('href')).toBe(
      '/report/rules-engine/2026/2027/harbor-city',
    );
    expect(screen.getByRole('link', { name: 'Report a record correction' }).getAttribute('href')).toBe(
      '/report/archive-correction/2026/2027/harbor-city',
    );
  });
});
