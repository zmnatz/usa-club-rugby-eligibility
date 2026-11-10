import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
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

const renderDirectory = (props: { autoFocus?: boolean; clubHref?: (key: string) => string } = {}) =>
  render(
    <ThemeProvider theme={createTheme()}>
      <EligibilityLinksProvider Link="a" routes={routes}>
        <ClubDirectory clubs={clubs} {...props} />
      </EligibilityLinksProvider>
    </ThemeProvider>,
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

  it('filters by name or side', async () => {
    const user = userEvent.setup();
    renderDirectory();
    await user.type(screen.getByRole('textbox', { name: 'Find a club' }), 'MD2');
    expect(screen.queryByRole('link', { name: /Harbor City/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Bayside/ })).toBeTruthy();
    expect(screen.getByText('1 of 2 clubs')).toBeTruthy();
  });

  it('puts the cursor in the filter when asked to', () => {
    renderDirectory({ autoFocus: true });
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Find a club' }));
  });

  it('leaves focus alone by default', () => {
    renderDirectory();
    expect(document.activeElement).toBe(document.body);
  });
});

describe('ClubDirectory without React', () => {
  /** The static HTML with its script run, and a way to type in the filter. */
  function loadStaticPage() {
    const page = document.createElement('div');
    page.innerHTML = renderToStaticMarkup(
      <ThemeProvider theme={createTheme()}>
        <EligibilityLinksProvider Link="a" routes={routes}>
          <ClubDirectory clubs={clubs} staticFilter />
        </EligibilityLinksProvider>
      </ThemeProvider>,
    );
    document.body.append(page);
    new Function(page.querySelector('script')?.textContent ?? '')();
    const input = page.querySelector('input') as HTMLInputElement;
    const type = (value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    const shown = () =>
      [...page.querySelectorAll('li')].filter((club) => !club.hidden).map((club) => club.querySelector('a')?.getAttribute('href'));
    const text = (selector: string) => page.querySelector(selector) as HTMLElement;
    return { page, type, shown, count: text('[data-club-count]'), none: text('[data-no-club]') };
  }

  it('filters by name or side, the same as React', () => {
    const { page, type, shown, count, none } = loadStaticPage();
    type('  md2 ');
    expect(shown()).toEqual(['/teams/bayside.html']);
    expect(count.textContent).toBe('1 of 2 clubs');
    expect(none.hidden).toBe(true);
    page.remove();
  });

  it('says when nothing matches, and restores the list when cleared', () => {
    const { page, type, shown, count, none } = loadStaticPage();
    type('nowhere');
    expect(shown()).toEqual([]);
    expect(none.hidden).toBe(false);
    type('');
    expect(shown()).toHaveLength(2);
    expect(count.textContent).toBe('2 of 2 clubs');
    expect(none.hidden).toBe(true);
    page.remove();
  });

  it('adds no script unless asked to', () => {
    const { container } = renderDirectory();
    expect(container.querySelector('script')).toBeNull();
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
