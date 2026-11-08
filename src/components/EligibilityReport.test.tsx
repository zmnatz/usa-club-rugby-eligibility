import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EligibilityLinksProvider } from '@zmnatz/usa-club-rugby-components';
import { routes } from '@/utils/paths';
import { EligibilityReport } from './EligibilityReport';

const realFetch = globalThis.fetch;
let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
  globalThis.fetch = (async () => new Response('{"fixtures":[]}')) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const renderCsvReport = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <EligibilityLinksProvider Link="a" routes={routes}>
        <EligibilityReport source="csv" />
      </EligibilityLinksProvider>
    </QueryClientProvider>,
  );

describe('a Match Participation Report', () => {
  const runReport = async (csv: string) => {
    renderCsvReport();
    await user.click(screen.getByRole('textbox', { name: /paste the CSV/ }));
    await user.paste(csv);
    await user.click(screen.getByRole('button', { name: 'Run Breakdown' }));
  };

  it("shows the error when a report can't be read", async () => {
    await runReport('Not,The,Right,Columns\n1,2,3,4\n');
    expect(await screen.findByText('The CSV is missing an expected column: "USA ID"')).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('shows the error when a report has no players', async () => {
    await runReport('USA ID,First Name\n');
    expect(await screen.findByText('The CSV contains a header but no player rows.')).toBeTruthy();
  });
});
