import { useEffect, useMemo, useRef, useState } from 'react';
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
}

/** Every club, filtered by name or side. Each club opens the host's club route. */
export function ClubDirectory({ clubs, autoFocus = false }: ClubDirectoryProps) {
  const { Link, routes } = useEligibilityLinks();
  const [query, setQuery] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);

  // In an effect because React ignores autoFocus when hydrating a server-rendered page.
  useEffect(() => {
    if (autoFocus) searchInput.current?.focus();
  }, [autoFocus]);

  const sorted = useMemo(
    () => [...clubs].sort((a, b) => a.name.localeCompare(b.name)),
    [clubs],
  );
  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return sorted;
    return sorted.filter(
      (club) =>
        club.name.toLowerCase().includes(term) ||
        club.sides.some((side) => side.teamName.toLowerCase().includes(term)),
    );
  }, [sorted, query]);

  return (
    <Card component="section">
      <CardContent>
        <Stack direction="row" spacing={2} useFlexGap sx={{ ...spreadRow, mb: 2 }}>
          <TextField
            size="small"
            label="Find a club"
          sx={{ flex: '1 1 260px', maxWidth: 420 }}
            placeholder="Club or team name"
            inputRef={searchInput}
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
              <Link href={routes.club(club.key)}>
                {club.name}
                <span>{club.sides.map((side) => side.label).join(' · ')}</span>
              </Link>
            </li>
          ))}
        </ClubList>
        {shown.length === 0 && (
          <Typography color="text.secondary">No club matches “{query}”.</Typography>
        )}
      </CardContent>
    </Card>
  );
}
