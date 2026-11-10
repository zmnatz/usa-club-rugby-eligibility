import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen } from '@testing-library/react';
import type { PublishedClub } from '@zmnatz/usa-club-rugby-data';
import { ClubDirectory } from './ClubDirectory.tsx';
import { ENHANCEMENT_SCRIPT } from './enhance.ts';
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
  // The host's one script, installed once on the page.
  new Function(ENHANCEMENT_SCRIPT)();

  /** The directory as static HTML, with a way to type in its filter. */
  function loadStaticPage() {
    const page = document.createElement('div');
    page.innerHTML = renderToStaticMarkup(
      <EligibilityLinksProvider Link="a" routes={routes}>
        <ClubDirectory clubs={clubs} />
      </EligibilityLinksProvider>,
    );
    document.body.append(page);
    const input = page.querySelector('input') as HTMLInputElement;
    const type = (value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const shown = () =>
      [...page.querySelectorAll('li')].filter((club) => !club.hidden).map((club) => club.querySelector('a')?.getAttribute('href'));
    const text = (selector: string) => page.querySelector(selector) as HTMLElement;
    return { page, type, shown, count: text('[data-club-count]'), none: text('[data-no-club]') };
  }

  it('filters by name or side', () => {
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

  it('lists every club, with no script of its own, before the filter is used', () => {
    const { page, shown } = loadStaticPage();
    expect(shown()).toHaveLength(2);
    expect(page.querySelector('script')).toBeNull();
    page.remove();
  });

  it('also filters a directory React rendered in the browser', () => {
    const { container } = renderDirectory();
    const input = container.querySelector('input') as HTMLInputElement;
    input.value = 'bayside';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(screen.getByRole('link', { name: /Harbor City/, hidden: true }).closest('li')?.hidden).toBe(true);
    expect(screen.getByRole('link', { name: /Bayside/ }).closest('li')?.hidden).toBe(false);
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
