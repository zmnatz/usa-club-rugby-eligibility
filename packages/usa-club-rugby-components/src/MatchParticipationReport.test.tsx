import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FeedFixture } from '@zmnatz/usa-club-rugby-data';
import { fixture, routes } from './__fixtures__/report.tsx';
import { EligibilityLinksProvider } from './links.tsx';
import { MatchParticipationReport } from './MatchParticipationReport.tsx';

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
});

const renderCsvReport = (loadFixtures?: () => Promise<FeedFixture[]>) =>
  render(
    <EligibilityLinksProvider Link="a" routes={routes}>
      <MatchParticipationReport loadFixtures={loadFixtures} />
    </EligibilityLinksProvider>,
  );

const HEADER = 'USA ID,First Name,Last Name,Player Last Registered,Team Name,Competition,Appearances,Played,Substitute,Round 1';
const REPORT = `${HEADER}
1001,Ona,Track,2026-08-01,Harbor City MD1,Test League Men D1,1,1,0,Start
1002,Eli,Clear,2026-08-01,Harbor City MD1,Test League Men D1,2,2,0,Start
`;

const pasteReport = async (csv: string) => {
  await user.click(screen.getByLabelText(/paste the CSV/));
  await user.paste(csv);
};

const run = () => user.click(screen.getByRole('button', { name: 'Run Breakdown' }));

describe('a Match Participation Report', () => {
  const runReport = async (csv: string) => {
    renderCsvReport();
    await pasteReport(csv);
    await run();
  };

  it("shows the error when a report can't be read", async () => {
    await runReport('Not,The,Right,Columns\n1,2,3,4\n');
    expect(await screen.findByText('The CSV is missing an expected column: "USA ID"')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows the error when a report has no players', async () => {
    await runReport('USA ID,First Name\n');
    expect(await screen.findByText('The CSV contains a header but no player rows.')).toBeTruthy();
  });

  it('runs a pasted report and shows each verdict', async () => {
    await runReport(REPORT);
    const row = within(screen.getByText('Eli Clear').closest('tr') as HTMLElement);
    expect(row.getByText('ELIGIBLE')).toBeTruthy();
    expect(screen.getByText('USA ID 1002')).toBeTruthy();
  });

  it('uploads a report from a file', async () => {
    renderCsvReport();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File([REPORT], 'report.csv', { type: 'text/csv' }));
    await screen.findByText('Loaded: report.csv');
    await run();
    expect(await screen.findByText('Eli Clear')).toBeTruthy();
  });

  it('clears the report back to the empty form', async () => {
    await runReport(REPORT);
    await user.click(screen.getByRole('button', { name: 'Edit Report Data' }));
    await user.click(await screen.findByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(screen.queryByText('Eli Clear')).toBeNull());
    expect(screen.getByText(/Upload a report and run the breakdown/)).toBeTruthy();
    expect((screen.getByLabelText(/paste the CSV/) as HTMLTextAreaElement).value).toBe('');
  });

  const upcoming = fixture('b9', 'Harbor City MD1', '2099-05-01T17:00:00Z', {
    status: 'Scheduled',
    homeTeam: { name: 'Harbor City MD1', score: '' },
    awayTeam: { name: 'Bayside MD1', score: '' },
  });

  it('counts the fixtures the host loads towards on-track verdicts', async () => {
    renderCsvReport(async () => [upcoming]);
    await pasteReport(REPORT);
    await run();
    const row = (await screen.findByText('Ona Track')).closest('tr') as HTMLElement;
    expect(within(row).getByText('ON TRACK')).toBeTruthy();
  });

  it('loads the fixtures only once a report is run', async () => {
    const loadFixtures = mock(async () => [upcoming]);
    renderCsvReport(loadFixtures);
    await pasteReport(REPORT);
    expect(loadFixtures).not.toHaveBeenCalled();
    await run();
    await screen.findByText('Ona Track');
    expect(loadFixtures).toHaveBeenCalledTimes(1);
  });

  it('does not load the fixtures for a report that cannot be read', async () => {
    const loadFixtures = mock(async () => [upcoming]);
    renderCsvReport(loadFixtures);
    await pasteReport('USA ID,First Name\n');
    await run();
    await screen.findByText('The CSV contains a header but no player rows.');
    expect(loadFixtures).not.toHaveBeenCalled();
  });

  it('shows no verdicts until the fixtures have loaded', async () => {
    renderCsvReport(() => new Promise(() => {}));
    await pasteReport(REPORT);
    await run();
    expect(screen.queryByText('Ona Track')).toBeNull();
  });

  it('still runs the report if the fixtures fail to load', async () => {
    renderCsvReport(() => Promise.reject(new Error('unavailable')));
    await pasteReport(REPORT);
    await run();
    const row = (await screen.findByText('Ona Track')).closest('tr') as HTMLElement;
    expect(within(row).getByText('INELIGIBLE')).toBeTruthy();
  });
});
