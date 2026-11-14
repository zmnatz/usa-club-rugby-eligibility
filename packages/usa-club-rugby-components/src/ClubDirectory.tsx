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
  /** Where each club links, when not the host's club route: a past season's pages. Used
   *  as given, in a plain anchor (see below), so give the URL the host serves. */
  clubHref?: (clubKey: string) => string;
}

/** Everything the filter matches. */
const searchText = (club: PublishedClub) =>
  [club.name, ...club.sides.map((side) => side.teamName)].join('\n').toLowerCase();

/** Every club, as links, with a filter by club or team name. The links are plain anchors,
 *  not the host's Link: a directory can list hundreds of clubs, and each Link adds to the
 *  work of hydrating the page, where an anchor adds almost none. */
export function ClubDirectory({ clubs, autoFocus = false, clubHref }: ClubDirectoryProps) {
  const { routes } = useEligibilityLinks();
  const [query, setQuery] = useState('');

  const sorted = useMemo(() => [...clubs].sort((a, b) => a.name.localeCompare(b.name)), [clubs]);
  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return sorted;
    return sorted.filter((club) => searchText(club).includes(term));
  }, [sorted, query]);

  return (
    <Card component="section">
      <CardContent>
        <Stack direction="row" spacing={2} useFlexGap sx={{ ...spreadRow, mb: 2 }}>
          <TextField
            size="small"
            type="search"
            label="Find a club"
            sx={{ flex: '1 1 260px', maxWidth: 420 }}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { autoComplete: 'off' } }}
            placeholder="Club or team name"
            autoFocus={autoFocus}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Typography variant="body2" color="text.secondary">
            {shown.length} of {sorted.length} clubs
          </Typography>
        </Stack>
        <ClubList>
          {shown.map((club) => (
            <li key={club.key}>
              <a href={(clubHref ?? routes.club)(club.key)}>
                {club.name}
                <span>{club.sides.map((side) => side.label).join(' · ')}</span>
              </a>
            </li>
          ))}
        </ClubList>
        {shown.length === 0 && <Typography color="text.secondary">No club matches that search.</Typography>}
      </CardContent>
    </Card>
  );
}
