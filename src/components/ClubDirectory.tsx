import { useMemo, useState } from 'react';
import NextLink from 'next/link';
import {
  Box,
  Link as MuiLink,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import type { PublishedClub } from '@/utils/published';

/** The club list on the home page, filtered by name or side. Each club opens its
 *  own page at /<club-key>. */
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
    <Paper sx={{ p: 2 }}>
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          mb: 2,
        }}
      >
        <TextField
          size="small"
          label="Find a club"
          placeholder="Club or team name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          sx={{ minWidth: 260, flex: '1 1 260px', maxWidth: 420 }}
        />
        <Typography variant="body2" color="text.secondary">
          {shown.length} of {sorted.length} clubs
        </Typography>
      </Box>
      <Box
        component="ul"
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
          columnGap: 3,
        }}
      >
        {shown.map((club) => (
          <Box component="li" key={club.key} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <MuiLink
              component={NextLink}
              href={`/${club.key}`}
              underline="hover"
              sx={{ display: 'block', py: 1 }}
            >
              {club.name}
              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                {club.sides.map((side) => side.label).join(' · ')}
              </Typography>
            </MuiLink>
          </Box>
        ))}
      </Box>
      {shown.length === 0 && (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          No club matches “{query}”.
        </Typography>
      )}
    </Paper>
  );
}
