import type { PublishedClub } from '@zmnatz/usa-club-rugby-data';
import { useEligibilityLinks } from './links';

export interface ClubDirectoryProps {
  clubs: PublishedClub[];
  /** Put the cursor in the filter when the directory appears. For a page that is
   *  mainly the directory. Off by default. */
  autoFocus?: boolean;
  /** Where each club links, when not the host's club route: a past season's pages. */
  clubHref?: (clubKey: string) => string;
}

/** Everything the filter matches. */
const searchText = (club: PublishedClub) =>
  [club.name, ...club.sides.map((side) => side.teamName)].join('\n').toLowerCase();

/** Every club, as links. Typing in the filter hides the clubs that don't match; that is
 *  done by the one script the host includes (`ENHANCEMENT_SCRIPT`), so the list is
 *  complete HTML without it. */
export function ClubDirectory({ clubs, autoFocus = false, clubHref }: ClubDirectoryProps) {
  const { Link, routes } = useEligibilityLinks();
  const sorted = [...clubs].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="ec-card" data-club-directory>
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
            data-club-filter
          />
        </label>
        <span className="ec-muted ec-small" data-club-count>
          {sorted.length} of {sorted.length} clubs
        </span>
      </div>
      <ul className="ec-clubs">
        {sorted.map((club) => (
          <li key={club.key} data-search={searchText(club)}>
            <Link href={(clubHref ?? routes.club)(club.key)}>
              {club.name}
              <span>{club.sides.map((side) => side.label).join(' · ')}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="ec-muted" hidden data-no-club>
        No club matches that search.
      </p>
    </section>
  );
}
