import { type ReactNode, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControl,
  InputLabel,
  Link as MuiLink,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  buildReport,
  CAUTION_ADVICE,
  type Club,
  divisionLabel,
  type EligibilityBreakdown,
  filterPlayers,
  gapText,
  getColumns,
  hasSharedName,
  isNameWithheld,
  otherSideCount,
  type ParticipationGap,
  type PlayerEligibility,
  type ReportMeta,
  type ReportSource,
  type SortDirection,
  type SortKey,
  sameNamePlayers,
  sharedNames,
  sortPlayers,
  type StatusFilter,
  type TransferRecords,
} from '@zmnatz/usa-club-rugby-data';
import { EligibilityStatusChip, WaiverChip } from './EligibilityStatusChip.tsx';
import { spreadRow, wrapRow } from './layout.ts';
import { useEligibilityLinks } from './links.tsx';
import { FIRST_PLAYER_ID } from './SkipToFirstPlayer.tsx';

/** The columns a visitor can show or hide; the rest are always shown. */
const OPTIONAL_COLUMNS: SortKey[] = ['lastRegistered', 'played', 'sub'];

function PlayerCell({
  player,
  source,
  showCmsId,
  playerHref,
}: {
  player: PlayerEligibility;
  source: ReportSource;
  showCmsId: boolean;
  playerHref?: (playerId: string) => string;
}) {
  const { Link } = useEligibilityLinks();
  return (
    <>
      {playerHref && !isNameWithheld(player.name) ? (
        <MuiLink component={Link} href={playerHref(player.playerId)} sx={{ fontWeight: 'bold' }}>
          {player.name}
        </MuiLink>
      ) : (
        <Typography variant="body2" component="strong" sx={{ fontWeight: 'bold' }}>
          {player.name}
        </Typography>
      )}
      {source === 'csv' && (
        <Typography variant="caption" component="div" color="text.secondary">
          USA ID {player.playerId}
        </Typography>
      )}
      {source === 'record' && showCmsId && (
        <Typography variant="caption" component="div" color="text.secondary">
          CMS ID {player.playerId}
        </Typography>
      )}
    </>
  );
}

function cellContent(
  player: PlayerEligibility,
  key: SortKey,
  context: { source: ReportSource; showCmsId: boolean; playerHref?: (playerId: string) => string; moved: boolean },
): ReactNode {
  switch (key) {
    case 'name':
      return <PlayerCell player={player} {...context} />;
    case 'lastRegistered':
      return player.lastRegistered;
    case 'played':
      return player.played;
    case 'sub':
      return player.substitute;
    case 'participation':
      return <strong>{player.participation}</strong>;
    case 'status':
      return (
        <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <EligibilityStatusChip player={player} />
          {context.moved && <WaiverChip />}
        </Stack>
      );
    case 'reasons':
      return player.reasons.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {[...player.cautions, ...player.pending].join(' · ') || '—'}
        </Typography>
      ) : (
        <Typography variant="body2">{player.reasons.join(' · ')}</Typography>
      );
    default:
      return otherSideCount(player, key);
  }
}

interface SideTableProps {
  index: number;
  breakdown: EligibilityBreakdown;
  source: ReportSource;
  locked: boolean;
  playerHref?: (playerId: string) => string;
  transfers: TransferRecords;
}

/** One side's players: a status filter, a column chooser, and a table sorted by a
 *  column's header. */
function SideTable({ index, breakdown, source, locked, playerHref, transfers }: SideTableProps) {
  const side = breakdown.sides[index];
  const { summary } = side;
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'name', direction: 'asc' });
  const [status, setStatus] = useState<StatusFilter>('all');
  const [hiddenColumns, setHiddenColumns] = useState<SortKey[]>(OPTIONAL_COLUMNS);
  const players = filterPlayers(sortPlayers(side.players, sort.key, sort.direction), status);
  const sortBy = (key: SortKey) =>
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  const otherLabels = breakdown.sides.filter((entry) => entry.teamName !== side.teamName).map((entry) => entry.label);
  const columns = getColumns(otherLabels, source);
  const optional = columns.filter((column) => OPTIONAL_COLUMNS.includes(column.key));
  const shownColumns = columns.filter((column) => !hiddenColumns.includes(column.key));
  // From the whole side, so the id shows for both of a pair of same-named players.
  const shared = sharedNames(side.players);
  const titleId = `side-${index}-title`;

  return (
    <Card component="section" id={`side-${index}`} aria-labelledby={titleId}>
      <CardContent>
        <Stack direction="row" spacing={2} useFlexGap sx={{ ...spreadRow, mb: 2 }}>
          <Typography variant="h6" component="h2" id={titleId}>
            {divisionLabel(side.label, side.teamName, summary)}
          </Typography>
          <Stack direction="row" spacing={1.5} useFlexGap sx={wrapRow}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={status}
              onChange={(_, next) => {
                if (next) setStatus(next as StatusFilter);
              }}
              aria-label="Eligibility status"
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="eligible">Eligible</ToggleButton>
              {!locked && <ToggleButton value="caution">Caution</ToggleButton>}
              <ToggleButton value="ineligible">Ineligible</ToggleButton>
            </ToggleButtonGroup>
            <Chip
              size="small"
              color={summary.eligible === summary.total ? 'success' : summary.total === 0 ? 'default' : 'warning'}
              label={`${summary.eligible} of ${summary.total} eligible${summary.onTrack > 0 ? `, ${summary.onTrack} on track` : ''}${summary.caution > 0 ? `, ${summary.caution} caution` : ''}`}
            />
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel id={`side-${index}-columns`}>Columns</InputLabel>
              <Select
                multiple
                labelId={`side-${index}-columns`}
                label="Columns"
                value={optional.filter((column) => !hiddenColumns.includes(column.key)).map((column) => column.key)}
                onChange={(event) => {
                  const selected = event.target.value as SortKey[];
                  setHiddenColumns(OPTIONAL_COLUMNS.filter((key) => !selected.includes(key)));
                }}
                renderValue={(selected) => `Columns (${selected.length})`}
              >
                {optional.map((column) => (
                  <MenuItem key={column.key} value={column.key}>
                    <Checkbox checked={!hiddenColumns.includes(column.key)} size="small" />
                    <ListItemText primary={column.title} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {shownColumns.map((column) => (
                  <TableCell
                    key={column.key}
                    align={column.numeric ? 'right' : 'left'}
                    sortDirection={sort.key === column.key ? sort.direction : false}
                  >
                    <TableSortLabel
                      active={sort.key === column.key}
                      direction={sort.key === column.key ? sort.direction : 'asc'}
                      onClick={() => sortBy(column.key)}
                    >
                      {column.title}
                    </TableSortLabel>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {players.map((player, row) => (
                <TableRow
                  key={player.playerId}
                  // The skip link lands on the first row, whichever that is after a sort.
                  id={index === 0 && row === 0 ? FIRST_PLAYER_ID : undefined}
                  tabIndex={index === 0 && row === 0 ? -1 : undefined}
                >
                  {shownColumns.map((column) => (
                    <TableCell key={column.key} align={column.numeric ? 'right' : 'left'}>
                      {cellContent(player, column.key, {
                        source,
                        showCmsId: hasSharedName(player, shared),
                        playerHref,
                        moved: player.playerId in transfers,
                      })}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {players.length === 0 && (
                <TableRow id={index === 0 ? FIRST_PLAYER_ID : undefined} tabIndex={index === 0 ? -1 : undefined}>
                  <TableCell colSpan={shownColumns.length} align="center">
                    <Typography variant="body2" component="span" color="text.secondary">
                      {side.players.length === 0 ? 'No players in this team’s report.' : 'No players match this filter.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

export interface EligibilityReportViewProps {
  source: ReportSource;
  /** Who the report is for, with the sides it covers. */
  club: Pick<Club, 'name' | 'sides'>;
  breakdown: EligibilityBreakdown;
  /** Gaps in the match record, shown as a warning. Empty for a CSV report. */
  gaps?: ParticipationGap[];
  /** Named in the exported report. */
  season?: string;
  /** When the saved record was last updated (ISO, UTC), stamped on the export. A CSV
   *  report has none and is stamped with `now`. */
  recordsUpdated?: string;
  /** Stamps the exported report, and names its file. Defaults to the current time. */
  now?: Date;
  /** Where each player's name links, such as the host's URL for their detail. Without
   *  it, names are plain text. */
  playerHref?: (playerId: string) => string;
  /** A Locked Season: every verdict is final, so there is no Caution to filter by. */
  locked?: boolean;
  /** Players who also played for another club that season, marked Waiver Required. */
  transfers?: TransferRecords;
  /** Extra controls beside Export Report. */
  actions?: ReactNode;
}

/** A club's verdicts, however they were worked out: notices, and a table of players for
 *  each side. */
export function EligibilityReportView({
  source,
  club,
  breakdown,
  gaps = [],
  season,
  recordsUpdated,
  now,
  playerHref,
  locked = false,
  transfers = {},
  actions,
}: EligibilityReportViewProps) {
  const oneSide = club.sides.length === 1;
  const sameNames = source === 'record' ? sameNamePlayers(breakdown.sides) : [];
  const meta: ReportMeta = { title: club.name, source, season, gaps, recordsUpdated };

  // Written when the button is pressed, so a CSV report is stamped with that time.
  const exportReport = () => {
    const stamp = now ?? new Date();
    const url = URL.createObjectURL(new Blob([buildReport(breakdown, meta, stamp)], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `eligibility-report-${(recordsUpdated ? new Date(recordsUpdated) : stamp).toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Stack spacing={2} useFlexGap>
      {oneSide && (
        <Typography variant="body2" color="textSecondary">
          Only one of this club&apos;s sides is in the data, so it is assessed as a one-side club:
          two qualifying matches, and no other side to compare.
        </Typography>
      )}

      {gaps.length > 0 && (
        <Alert severity="warning">
          These matches have gaps in the record, so some counts may be low. Check them
          before relying on a verdict:
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {gaps.map((gap) => (
              <li key={`${gap.fixtureId}-${gap.teamName}`}>{gapText(gap)}</li>
            ))}
          </Box>
        </Alert>
      )}

      {sameNames.length > 0 && (
        <Alert severity="info">
          These players share a name, so they are kept separate. If one person has two Rugby
          Xplorer profiles, their matches stay split until the profiles are merged, and each count
          may be low:
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {sameNames.map(({ name, ids }) => (
              <li key={name}>
                {name}: CMS IDs {ids.join(', ')}
              </li>
            ))}
          </Box>
        </Alert>
      )}

      {breakdown.ignoredTeamNames.length > 0 && (
        <Alert severity="info">
          Ignored rows for team(s) that aren&apos;t one of this club&apos;s NCS sides:{' '}
          {breakdown.ignoredTeamNames.join(', ')}.
        </Alert>
      )}

      {breakdown.sides.some((entry) => entry.summary.caution > 0) && (
        <Alert severity="warning">
          Caution marks players one upper-side match from losing a side for the rest of the
          season. {CAUTION_ADVICE}
        </Alert>
      )}

      <Stack direction="row" spacing={2} useFlexGap sx={spreadRow}>
        {oneSide ? (
          <div />
        ) : (
          <Stack component="nav" direction="row" spacing={1} useFlexGap sx={wrapRow} aria-label="Eligibility by division">
            {breakdown.sides.map((entry, index) => (
              <Button key={entry.teamName} size="small" href={`#side-${index}`}>
                {entry.label} side
              </Button>
            ))}
          </Stack>
        )}
        <Stack direction="row" spacing={1} useFlexGap sx={wrapRow}>
          {actions}
          <Button variant="outlined" size="small" onClick={exportReport}>
            Export Report
          </Button>
        </Stack>
      </Stack>

      {breakdown.sides.map((entry, index) => (
        <SideTable
          key={entry.teamName}
          index={index}
          breakdown={breakdown}
          source={source}
          locked={locked}
          playerHref={playerHref}
          transfers={transfers}
        />
      ))}
    </Stack>
  );
}
