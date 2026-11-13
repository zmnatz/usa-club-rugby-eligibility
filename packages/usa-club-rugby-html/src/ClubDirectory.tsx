import { useState } from 'react';
import type { PublishedClub } from '@zmnatz/usa-club-rugby-data';
import { useEligibilityLinks } from './links.tsx';

export interface ClubDirectoryProps {
  clubs: PublishedClub[];
  /** Put the cursor in the filter when the directory appears. For a page that is
   *  mainly the directory. Off by default. */
  autoFocus?: boolean;
  /** Where each club links, when not the host's club route: a past season's pages. */
  clubHref?: (clubKey: string) => string;
  /** Clubs from an earlier season with no games on record yet this season, listed among
   *  the others and marked as such. Each links to `href`, e.g. that season's report. */
  withoutGames?: { clubs: PublishedClub[]; href: (clubKey: string) => string };
}

/** Everything the filter matches. */
const searchText = (club: PublishedClub) =>
  [club.name, ...club.sides.map((side) => side.teamName)].join('\n').toLowerCase();

/** Every club, as links, with a filter by club or team name. */
export function ClubDirectory({ clubs, autoFocus = false, clubHref, withoutGames }: ClubDirectoryProps) {
  const { Link, routes } = useEligibilityLinks();
  const [query, setQuery] = useState('');
  const sorted = [
    ...clubs.map((club) => ({ club, href: (clubHref ?? routes.club)(club.key), noGames: false })),
    ...(withoutGames?.clubs ?? []).map((club) => ({ club, href: withoutGames?.href(club.key) ?? '', noGames: true })),
  ].sort((a, b) => a.club.name.localeCompare(b.club.name));
  const term = query.trim().toLowerCase();
  const shown = sorted.filter(({ club }) => searchText(club).includes(term));

  return (
    <section className="ec-card">
      <div className="ec-row ec-spread" style={{ marginBottom: 16 }}>
        <label className="ec-field ec-search">
          Find a club
          <input
            className="ec-input"
            type="search"
            placeholder="Club or team name"
            autoComplete="off"
            // biome-ignore lint/a11y/noAutofocus: asked for by the page, which is mainly this list
            autoFocus={autoFocus}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <span className="ec-muted ec-small">
          {shown.length} of {sorted.length} clubs
        </span>
      </div>
      <ul className="ec-clubs">
        {shown.map(({ club, href, noGames }) => (
          <li key={`${noGames ? 'no-games:' : ''}${club.key}`}>
            <Link href={href}>
              {club.name}
              <span>{club.sides.map((side) => side.label).join(' · ')}</span>
              {noGames && <span className="ec-no-games">No games on record yet</span>}
            </Link>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="ec-muted">No club matches that search.</p>}
    </section>
  );
}
