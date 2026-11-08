import { useMemo, useState } from 'react';
import { Typography } from '@mui/material';
import type { PublishedClub } from '@zmnatz/usa-club-rugby-data';
import { useEligibilityLinks } from './links.tsx';
import { ClubItem, ClubLink, ClubList, EmptyNote, Panel, Row, SearchField, SideLabels } from './primitives.tsx';

/** Every club, filtered by name or side. Each club opens the host's club route. */
export function ClubDirectory({ clubs }: { clubs: PublishedClub[] }) {
  const { Link, routes } = useEligibilityLinks();
  const [query, setQuery] = useState('');

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
    <Panel>
      <Row gap={2} between below={2}>
        <SearchField
          size="small"
          label="Find a club"
          placeholder="Club or team name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Typography variant="body2" color="text.secondary">
          {shown.length} of {sorted.length} clubs
        </Typography>
      </Row>
      <ClubList>
        {shown.map((club) => (
          <ClubItem key={club.key}>
            <ClubLink component={Link} href={routes.club(club.key)} underline="hover">
              {club.name}
              <SideLabels component="span" variant="caption" color="text.secondary">
                {club.sides.map((side) => side.label).join(' · ')}
              </SideLabels>
            </ClubLink>
          </ClubItem>
        ))}
      </ClubList>
      {shown.length === 0 && (
        <EmptyNote color="text.secondary">No club matches “{query}”.</EmptyNote>
      )}
    </Panel>
  );
}
