import { useMemo, useState } from 'react';
import { Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import type { PublishedClub } from '@zmnatz/usa-club-rugby-data';
import { spreadRow } from './layout.ts';
import { useEligibilityLinks } from './links.tsx';
import { ClubList } from './primitives.tsx';

export interface ClubDirectoryProps {
  clubs: PublishedClub[];
  /** Put the cursor in the filter when the directory appears. For a page that is
   *  mainly the directory. Off by default. */
  autoFocus?: boolean;
  /** Add a small script that runs the filter, for a page served without React.
   *  It does nothing when React renders the directory in the browser. Off by default. */
  staticFilter?: boolean;
}

/** Everything the filter matches. */
const searchText = (club: PublishedClub) =>
  [club.name, ...club.sides.map((side) => side.teamName)].join('\n').toLowerCase();

// The filter below, for the rendered HTML. MUI sets its focus classes from JavaScript too.
const STATIC_FILTER = `(() => {
  const root = document.querySelector('[data-club-directory]');
  const input = root.querySelector('input');
  const clubs = [...root.querySelectorAll('li')];
  const count = root.querySelector('[data-club-count]');
  const none = root.querySelector('[data-no-club]');
  const filter = () => {
    const term = input.value.trim().toLowerCase();
    for (const club of clubs) club.hidden = !club.dataset.search.includes(term);
    const shown = clubs.filter((club) => !club.hidden).length;
    count.textContent = shown + ' of ' + clubs.length + ' clubs';
    none.hidden = shown > 0;
  };
  const showFocus = () => {
    for (const element of [input.parentElement, root.querySelector('label')]) {
      element.classList.toggle('Mui-focused', document.activeElement === input);
    }
  };
  input.addEventListener('input', filter);
  input.addEventListener('focus', showFocus);
  input.addEventListener('blur', showFocus);
  window.addEventListener('pageshow', () => { filter(); showFocus(); });
})();`;

/** Every club, filtered by name or side. Each club opens the host's club route. */
export function ClubDirectory({ clubs, autoFocus = false, staticFilter = false }: ClubDirectoryProps) {
  const { Link, routes } = useEligibilityLinks();
  const [query, setQuery] = useState('');

  const sorted = useMemo(
    () => [...clubs].sort((a, b) => a.name.localeCompare(b.name)),
    [clubs],
  );
  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return sorted;
    return sorted.filter((club) => searchText(club).includes(term));
  }, [sorted, query]);

  return (
    <Card component="section" data-club-directory>
      <CardContent>
        <Stack direction="row" spacing={2} useFlexGap sx={{ ...spreadRow, mb: 2 }}>
          <TextField
            size="small"
            label="Find a club"
            sx={{ flex: '1 1 260px', maxWidth: 420 }}
            slotProps={{ inputLabel: { shrink: true } }}
            placeholder="Club or team name"
            autoFocus={autoFocus}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Typography variant="body2" color="text.secondary" data-club-count>
            {shown.length} of {sorted.length} clubs
          </Typography>
        </Stack>
        <ClubList>
          {shown.map((club) => (
            <li key={club.key} data-search={searchText(club)}>
              <Link href={routes.club(club.key)}>
                {club.name}
                <span>{club.sides.map((side) => side.label).join(' · ')}</span>
              </Link>
            </li>
          ))}
        </ClubList>
        <Typography color="text.secondary" hidden={shown.length > 0} data-no-club>
          No club matches that search.
        </Typography>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed string, with no data in it */}
        {staticFilter && <script dangerouslySetInnerHTML={{ __html: STATIC_FILTER }} />}
      </CardContent>
    </Card>
  );
}
