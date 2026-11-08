import { useMemo, useState } from 'react';
import { clubPath } from '@/utils/paths';
import NextLink from 'next/link';
import { Typography } from '@mui/material';
import { ClubItem, ClubLink, ClubList, EmptyNote, Panel, Row, SearchField, SideLabels } from '@/theme';
import type { PublishedClub } from '@/utils/published';

/** The club list on the home page, filtered by name or side. Each club opens its
 *  own page at /club/<club-key>. */
export function ClubDirectory({ clubs }: { clubs: PublishedClub[] }) {
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
            <ClubLink component={NextLink} href={clubPath(club.key)} underline="hover">
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
