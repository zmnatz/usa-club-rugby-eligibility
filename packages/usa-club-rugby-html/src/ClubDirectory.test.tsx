import { describe, expect, it } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
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

const renderDirectory = (props: { autoFocus?: boolean; clubHref?: (key: string) => string } = {}) =>
  render(
    <EligibilityLinksProvider Link="a" routes={routes}>
      <ClubDirectory clubs={clubs} {...props} />
    </EligibilityLinksProvider>,
  );

function PlayerLink({ id }: { id: string }) {
  const { Link, routes: hostRoutes } = useEligibilityLinks();
  return <Link href={hostRoutes.player(id)}>Player</Link>;
}

describe('ClubDirectory', () => {
  it('links each club to the given address instead of the club route, for a past season', () => {
    renderDirectory({ clubHref: (key) => `/season/2024-25/club/${key}` });
    expect(screen.getByRole('link', { name: /Bayside/ }).getAttribute('href')).toBe('/season/2024-25/club/bayside');
  });

  it('links each club through the plain anchor and custom route', () => {
    renderDirectory();
    const link = screen.getByRole('link', { name: /Harbor City/ });
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/teams/harbor-city.html');
  });

  it('puts the cursor in the filter when asked to', () => {
    renderDirectory({ autoFocus: true });
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Find a club' }));
  });

  it('leaves focus alone by default', () => {
    renderDirectory();
    expect(document.activeElement).toBe(document.body);
  });
});

describe('the directory filter', () => {
  const type = (value: string) => {
    const input = screen.getByRole('searchbox', { name: 'Find a club' });
    fireEvent.change(input, { target: { value } });
  };
  const shown = () => screen.queryAllByRole('link').map((link) => link.getAttribute('href'));

  it('filters by name or side', () => {
    renderDirectory();
    type('  md2 ');
    expect(shown()).toEqual(['/teams/bayside.html']);
    expect(screen.getByText('1 of 2 clubs')).toBeTruthy();
    expect(screen.queryByText('No club matches that search.')).toBeNull();
  });

  it('says when nothing matches, and restores the list when cleared', () => {
    renderDirectory();
    type('nowhere');
    expect(shown()).toEqual([]);
    expect(screen.getByText('No club matches that search.')).toBeTruthy();
    type('');
    expect(shown()).toHaveLength(2);
    expect(screen.getByText('2 of 2 clubs')).toBeTruthy();
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
