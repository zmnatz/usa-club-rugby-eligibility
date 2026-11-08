import { describe, expect, it } from 'bun:test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import type { PublishedClub } from '@zmnatz/usa-club-rugby-data';
import { ClubDirectory } from './ClubDirectory.tsx';
import { EligibilityLinksProvider, type EligibilityRoutes, useEligibilityLinks } from './links.tsx';

const clubs: PublishedClub[] = [
  { key: 'bayside', name: 'Bayside', sides: [{ label: 'D2', teamName: 'Bayside MD2' }] },
  { key: 'harbor-city', name: 'Harbor City', sides: [{ label: 'D1', teamName: 'Harbor City MD1' }] },
];

const routes: EligibilityRoutes = {
  club: (key) => `/teams/${key}.html`,
  player: (id) => `/player?id=${encodeURIComponent(id)}`,
  methodology: () => '/about',
};

const renderDirectory = () =>
  render(
    <ThemeProvider theme={createTheme()}>
      <EligibilityLinksProvider Link="a" routes={routes}>
        <ClubDirectory clubs={clubs} />
      </EligibilityLinksProvider>
    </ThemeProvider>,
  );

function PlayerLink({ id }: { id: string }) {
  const { Link, routes: hostRoutes } = useEligibilityLinks();
  return <Link href={hostRoutes.player(id)}>Player</Link>;
}

describe('ClubDirectory', () => {
  it('links each club through the plain anchor and custom route', () => {
    renderDirectory();
    const link = screen.getByRole('link', { name: /Harbor City/ });
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/teams/harbor-city.html');
  });

  it('filters by name or side', async () => {
    const user = userEvent.setup();
    renderDirectory();
    await user.type(screen.getByRole('textbox', { name: 'Find a club' }), 'MD2');
    expect(screen.queryByRole('link', { name: /Harbor City/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Bayside/ })).toBeTruthy();
    expect(screen.getByText('1 of 2 clubs')).toBeTruthy();
  });
});

describe('EligibilityLinksProvider', () => {
  it('can express a query-string player route', () => {
    render(
      <EligibilityLinksProvider Link="a" routes={routes}>
        <PlayerLink id="a b" />
      </EligibilityLinksProvider>,
    );
    expect(screen.getByRole('link', { name: 'Player' }).getAttribute('href')).toBe('/player?id=a%20b');
  });

  it('explains itself when a host forgets it', () => {
    expect(() => render(<PlayerLink id="x" />)).toThrow('EligibilityLinksProvider');
  });
});
