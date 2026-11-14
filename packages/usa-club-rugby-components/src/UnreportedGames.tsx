import { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Link as MuiLink,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  competitionLabel,
  DEFAULT_UNREPORTED,
  filterUnreported,
  formatDate,
  matchUrl,
  type UnreportedFilters,
  type UnreportedGame,
  type UnreportedReasonKind,
  type UnreportedSide,
  type UnreportedTone,
  unreportedGameCount,
  unreportedReasonText,
  unreportedSideTone,
  unreportedTone,
} from '@zmnatz/usa-club-rugby-data';
import { spreadRow, wrapRow } from './layout.ts';
import { useEligibilityLinks } from './links.tsx';

// The filters and their wording are the data package's (`filterUnreported`), shared with
// the HTML package's list. Re-exported, so a host imports the list and its filters together.
export {
  DEFAULT_UNREPORTED,
  UNREPORTED_REASONS,
  type UnreportedFilters,
  type UnreportedReasonKind,
} from '@zmnatz/usa-club-rugby-data';

export interface UnreportedGamesProps {
  games: UnreportedGame[];
  /** The filters, for a host that keeps them, e.g. in the URL. Without them the list keeps
   *  its own, starting from `DEFAULT_UNREPORTED`. A division the games don't offer reads
   *  as `all`. */
  filters?: UnreportedFilters;
  onFiltersChange?: (filters: UnreportedFilters) => void;
}

/** A cell flagged in a reason's colour: the theme's, so it follows the host's palette. The
 *  tone is also on the cell as `data-tone`. */
const flagged = (tone: UnreportedTone | null) =>
  tone ? { borderLeft: 4, borderLeftColor: `${tone}.main`, borderLeftStyle: 'solid' } : undefined;

function Side({ side }: { side: UnreportedSide }) {
  const { Link, routes } = useEligibilityLinks();
  // The team, which says which of a club's sides played, shows on hover.
  return side.clubKey ? (
    <MuiLink component={Link} href={routes.club(side.clubKey)} title={side.teamName}>
      {side.clubName}
    </MuiLink>
  ) : (
    <span title={side.teamName}>{side.clubName}</span>
  );
}

function GameRow({ game, showCompetition }: { game: UnreportedGame; showCompetition: boolean }) {
  // A missing result is the game's, not a side's, so it marks the date.
  const noResult = game.reasons.some((reason) => reason.kind === 'no-result');
  return (
    <TableRow>
      <TableCell sx={flagged(noResult ? 'info' : null)} data-tone={noResult ? 'info' : undefined}>
        <MuiLink href={matchUrl(game.fixtureId)} target="_blank" rel="noopener noreferrer">
          {formatDate(game.dateTime)}
        </MuiLink>
      </TableCell>
      {showCompetition && <TableCell>{competitionLabel(game.competition)}</TableCell>}
      {[game.home, game.away].map((side) => (
        <TableCell
          key={side.teamName}
          sx={flagged(unreportedSideTone(game, side.teamName))}
          data-tone={unreportedSideTone(game, side.teamName) ?? undefined}
        >
          <Side side={side} />
        </TableCell>
      ))}
      <TableCell>
        <Box component="ul" sx={{ m: 0, pl: 2 }}>
          {game.reasons.map((reason) => (
            <Typography
              key={unreportedReasonText(reason)}
              component="li"
              variant="body2"
              sx={{ color: `${unreportedTone(reason.kind)}.main` }}
              data-tone={unreportedTone(reason.kind)}
            >
              {unreportedReasonText(reason)}
            </Typography>
          ))}
        </Box>
      </TableCell>
    </TableRow>
  );
}

/** One table of games. Without the grouping, it names each game's competition. */
function GamesTable({ games, showCompetition }: { games: UnreportedGame[]; showCompetition: boolean }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            {showCompetition && <TableCell>Competition</TableCell>}
            <TableCell>Home</TableCell>
            <TableCell>Away</TableCell>
            <TableCell>Reason</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {games.map((game) => (
            <GameRow key={game.fixtureId} game={game} showCompetition={showCompetition} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** Current-season games whose record still needs entering, in a collapsible group per
 *  competition or one list, filterable by division, competition and reasons. */
export function UnreportedGames({ games, filters, onFiltersChange }: UnreportedGamesProps) {
  const [own, setOwn] = useState(DEFAULT_UNREPORTED);
  const [grouped, setGrouped] = useState(true);
  // The groups closed, by competition, so Expand all and Collapse all and a group's own
  // summary all work on one state.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const setOpen = (name: string, open: boolean) =>
    setCollapsed((current) => {
      if (open !== current.has(name)) return current;
      const next = new Set(current);
      if (open) next.delete(name);
      else next.add(name);
      return next;
    });
  const current = filters ?? own;
  const change = (next: Partial<UnreportedFilters>) => (onFiltersChange ?? setOwn)({ ...current, ...next });

  if (games.length === 0) {
    return (
      <Card component="section">
        <CardContent>
          <Typography color="text.secondary">No games are overdue.</Typography>
        </CardContent>
      </Card>
    );
  }

  const { shown, division, divisions, reasons, competitions, groups } = filterUnreported(games, current);
  // "All" is on when no reason is; choosing it turns the others off.
  const toggled: (UnreportedReasonKind | 'all')[] = current.reasons.length === 0 ? ['all'] : current.reasons;

  return (
    <Card component="section" aria-labelledby="unreported-title">
      <CardContent>
        <Stack direction="row" spacing={2} useFlexGap sx={{ ...spreadRow, mb: 2 }}>
          <Typography variant="h6" component="h2" id="unreported-title" aria-live="polite">
            {shown.length === games.length
              ? unreportedGameCount(games.length)
              : `${shown.length} of ${unreportedGameCount(games.length)}`}
          </Typography>
          <Stack direction="row" spacing={1.5} useFlexGap sx={wrapRow}>
            <TextField
              select
              size="small"
              label="Division"
              value={division}
              onChange={(event) => change({ division: event.target.value })}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="all">All divisions</MenuItem>
              {divisions.map(([code, label]) => (
                <MenuItem key={code} value={code}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <Autocomplete
              freeSolo
              size="small"
              sx={{ minWidth: 240 }}
              options={competitions.map(({ label }) => label)}
              inputValue={current.competition}
              onInputChange={(_, value) => change({ competition: value })}
              renderInput={(params) => <TextField {...params} label="Competition" placeholder="Any competition" />}
            />
            <ToggleButtonGroup
              size="small"
              value={toggled}
              aria-label="Reasons"
              onChange={(_, next: (UnreportedReasonKind | 'all')[]) => {
                // The newest choice is last: "All" clears the rest, and any other clears "All".
                const chosen = next.at(-1);
                change({
                  reasons:
                    chosen === 'all' || next.length === 0
                      ? []
                      : next.filter((kind): kind is UnreportedReasonKind => kind !== 'all'),
                });
              }}
            >
              <ToggleButton value="all">All</ToggleButton>
              {reasons.map(([kind, label]) => (
                <ToggleButton key={kind} value={kind} color={unreportedTone(kind)} data-tone={unreportedTone(kind)}>
                  {label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>
        </Stack>
        <Stack direction="row" spacing={1} useFlexGap sx={{ ...wrapRow, mb: 2 }}>
          <FormControlLabel
            control={<Checkbox size="small" checked={grouped} onChange={(event) => setGrouped(event.target.checked)} />}
            label="Group by competition"
          />
          {/* Disabled rather than hidden without the grouping, so the row keeps its height. */}
          <Button size="small" variant="outlined" disabled={!grouped} onClick={() => setCollapsed(new Set())}>
            Expand all
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled={!grouped}
            onClick={() => setCollapsed(new Set(competitions.map(({ name }) => name)))}
          >
            Collapse all
          </Button>
        </Stack>
        {shown.length === 0 && <Typography color="text.secondary">No games match these filters.</Typography>}
        {!grouped && shown.length > 0 && <GamesTable games={shown} showCompetition />}
        {grouped &&
          groups.map((group) => (
            <Accordion
              key={group.name}
              disableGutters
              expanded={!collapsed.has(group.name)}
              onChange={(_, open) => setOpen(group.name, open)}
            >
              <AccordionSummary>
                <Typography component="span">
                  {group.label}{' '}
                  <Typography component="span" variant="body2" color="text.secondary">
                    ({unreportedGameCount(group.games.length)})
                  </Typography>
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <GamesTable games={group.games} showCompetition={false} />
              </AccordionDetails>
            </Accordion>
          ))}
      </CardContent>
    </Card>
  );
}
