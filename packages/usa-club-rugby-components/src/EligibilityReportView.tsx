import { type ReactNode, useMemo, useState } from 'react';
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
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  type Club,
  divisionLabel,
  type EligibilityBreakdown,
  hasSharedName,
  isNameWithheld,
  type ParticipationGap,
  type PlayerEligibility,
  type PlayerRecordInput,
  sameNamePlayers,
  sharedNames,
  verdictRank,
  type TransferRecords,
} from '@zmnatz/usa-club-rugby-data';
import { formatDate } from './dates.ts';
import { EligibilityStatusChip, WaiverChip } from './EligibilityStatusChip.tsx';
import { spreadRow, wrapRow } from './layout.ts';
import { useEligibilityLinks } from './links.tsx';
import { CAUTION_ADVICE, PlayerEligibilityDialog, type ReportSource } from './PlayerDetail.tsx';
import { FIRST_PLAYER_ID } from './SkipToFirstPlayer.tsx';
import { compareValues, type SortDirection } from './sort.ts';

type StatusFilter = 'all' | 'eligible' | 'caution' | 'ineligible';

/** A fixed column, or `other:<label>` for another side's participation. */
type SortKey =
  | 'name'
  | 'lastRegistered'
  | 'played'
  | 'sub'
  | 'participation'
  | 'status'
  | 'reasons'
  | `other:${string}`;

const getColumns = (
  otherLabels: string[],
  source: ReportSource,
): { key: SortKey; title: string; numeric?: boolean }[] => [
  { key: 'name', title: 'Player' },
  ...(source === 'csv' ? [{ key: 'lastRegistered' as const, title: 'Last Registered' }] : []),
  { key: 'played', title: 'Played', numeric: true },
  { key: 'sub', title: 'Sub', numeric: true },
  { key: 'participation', title: 'Participation', numeric: true },
  ...otherLabels.map((label) => ({
    key: `other:${label}` as const,
    title: `${label} Participation`,
    numeric: true,
  })),
  { key: 'status', title: 'Status' },
  { key: 'reasons', title: 'Reason' },
];

/** A player's participation for an `other:<label>` column. */
function otherSideCount(player: PlayerEligibility, key: `other:${string}`): number {
  const label = key.slice('other:'.length);
  return player.otherSides.find((side) => side.label === label)?.participation ?? 0;
}

function sortValue(player: PlayerEligibility, key: SortKey): string | number {
  switch (key) {
    case 'name':
      return player.name;
    case 'lastRegistered':
      return player.lastRegistered;
    case 'played':
      return player.played;
    case 'sub':
      return player.substitute;
    case 'participation':
      return player.participation;
    case 'status':
      return verdictRank(player);
    case 'reasons':
      return player.reasons.length + player.cautions.length + player.pending.length;
    default:
      return otherSideCount(player, key);
  }
}

interface DivisionTableProps {
  title: string;
  source: ReportSource;
  ownLabel: string;
  /** The club's other sides; empty for a club with one side. */
  otherLabels: string[];
  /** What the player detail accounts each round from; absent for a CSV report. */
  record: PlayerRecordInput | null;
  /** Whether the players have pages of their own; a CSV report's don't. */
  playerPages: boolean;
  locked: boolean;
  transfers: TransferRecords;
  /** Rugby Xplorer's own club slug, for match-report links. */
  clubSlug: string | null;
  summary: { total: number; eligible: number; onTrack: number; caution: number };
  visibleCount: number;
  filtered: boolean;
  hiddenColumns: string[];
  onHiddenColumnsChange: (cols: string[]) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  players: PlayerEligibility[];
  /** The side's players before filtering. */
  allPlayers: PlayerEligibility[];
}

function renderCell(
  player: PlayerEligibility,
  key: SortKey,
  source: ReportSource,
  showCmsId: boolean,
  buttonId: string | undefined,
  moved: boolean,
) {
  switch (key) {
    case 'name':
      return (
        <>
          {/* A real button, so the player can be reached and opened from the keyboard.
              Its click reaches the row, which opens the detail. */}
          <MuiLink
            component="button"
            color="inherit"
            underline="none"
            align="left"
            id={buttonId}
            type="button"
            aria-haspopup="dialog"
            aria-label={`${player.name}: open eligibility details`}
          >
            <Typography variant="body2" component="strong">
              {player.name}
            </Typography>
          </MuiLink>
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
    case 'lastRegistered':
      return player.lastRegistered;
    case 'played':
      return player.played;
    case 'sub':
      return player.substitute;
    case 'participation':
      return player.participation;
    case 'status':
      return (
        <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <EligibilityStatusChip player={player} />
          {moved && <WaiverChip />}
        </Stack>
      );
    case 'reasons':
      return player.reasons.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {[...player.cautions, ...player.pending].join(' · ') || '—'}
        </Typography>
      ) : (
        <Typography variant="body2">
          {player.reasons.join(' · ')}
        </Typography>
      );
    default:
      return otherSideCount(player, key);
  }
}

function DivisionTable({
  title,
  source,
  ownLabel,
  otherLabels,
  record,
  playerPages,
  locked,
  transfers,
  clubSlug,
  summary,
  visibleCount,
  filtered,
  hiddenColumns,
  onHiddenColumnsChange,
  statusFilter,
  onStatusFilterChange,
  players,
  allPlayers,
}: DivisionTableProps) {
  const { routes } = useEligibilityLinks();
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'name',
    direction: 'asc',
  });
  const [detail, setDetail] = useState<PlayerEligibility | null>(null);

  // From the whole side, so a filter hiding one of the pair still shows the id.
  const shared = useMemo(() => sharedNames(allPlayers), [allPlayers]);
  const columns = getColumns(otherLabels, source);
  const visibleColumns = columns.filter((col) => !hiddenColumns.includes(col.key));

  const handleSort = (key: SortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
  };

  const rows = useMemo(
    () =>
      [...players].sort((a, b) =>
        compareValues(sortValue(a, sort.key), sortValue(b, sort.key), sort.direction),
      ),
    [players, sort],
  );

  return (
    <Card component="section">
      <CardContent>
        <Stack direction="row" spacing={2} useFlexGap sx={{ ...spreadRow, mb: 2 }}>
          <Stack direction="row" spacing={1} useFlexGap sx={wrapRow}>
            <Typography variant="h6" component="h2">
              {title}
            </Typography>
            {filtered && (
              <Typography variant="caption" color="text.secondary">
                Showing {visibleCount} of {summary.total}
              </Typography>
            )}
          </Stack>
          <Stack direction="row" spacing={1.5} useFlexGap sx={wrapRow}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={statusFilter}
              onChange={(_, next) => {
                if (next) onStatusFilterChange(next as StatusFilter);
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
              <InputLabel>Columns</InputLabel>
              <Select
                multiple
                value={columns.filter((col) => !hiddenColumns.includes(col.key)).map((col) => col.key)}
                label="Columns"
                onChange={(event) => {
                  const selected = event.target.value as string[];
                  onHiddenColumnsChange(
                    columns.map((col) => col.key).filter((key) => !selected.includes(key)),
                  );
                }}
                renderValue={(selected) => `Columns (${selected.length})`}
              >
                {columns.map((col) => {
                  const locked = col.key === 'name';
                  return (
                    <MenuItem key={col.key} value={col.key} disabled={locked}>
                      <Checkbox checked={!hiddenColumns.includes(col.key)} disabled={locked} size="small" />
                      <ListItemText primary={col.title} />
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Stack>
        </Stack>
        <TableContainer>
          <Table size="small" sx={{ '& .MuiTableRow-hover': { cursor: 'pointer' } }}>
            <TableHead>
              <TableRow>
                {visibleColumns.map((col) => (
                  <TableCell key={col.key} align={col.numeric ? 'right' : 'left'}>
                    <TableSortLabel
                      active={sort.key === col.key}
                      direction={sort.key === col.key ? sort.direction : 'asc'}
                      onClick={() => handleSort(col.key)}
                    >
                      {col.title}
                    </TableSortLabel>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((player, index) => (
                <TableRow key={player.playerId} hover onClick={() => setDetail(player)}>
                  {visibleColumns.map((col) => {
                    const content = renderCell(
                      player,
                      col.key,
                      source,
                      hasSharedName(player, shared),
                      index === 0 ? FIRST_PLAYER_ID : undefined,
                      player.playerId in transfers,
                    );
                    return (
                      <TableCell key={col.key} align={col.numeric ? 'right' : 'left'}>
                        {col.key === 'participation' ? <strong>{content}</strong> : content}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell id={FIRST_PLAYER_ID} tabIndex={-1} colSpan={visibleColumns.length} align="center">
                    <Typography variant="body2" component="span" color="text.secondary">
                      {filtered
                        ? 'No players match the current filters.'
                        : `No players in this team's report.`}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <PlayerEligibilityDialog
          player={detail}
          source={source}
          ownLabel={ownLabel}
          record={record}
          otherClubs={detail ? transfers[detail.playerId] : undefined}
          clubSlug={clubSlug}
          pageHref={detail && playerPages && !isNameWithheld(detail.name) ? routes.player(detail.playerId) : undefined}
          showCmsId={detail !== null && hasSharedName(detail, shared)}
          onClose={() => setDetail(null)}
        />
      </CardContent>
    </Card>
  );
}

function reportPlayerLine(player: PlayerEligibility, source: ReportSource, shared: Set<string>): string {
  const shownName =
    source === 'csv'
      ? `${player.name} (#${player.playerId})`
      : hasSharedName(player, shared)
        ? `${player.name} (CMS ID ${player.playerId})`
        : player.name;
  return (
    `${shownName}: ` +
    `played ${player.played} / sub ${player.substitute} ` +
    `(participation ${player.participation})` +
    player.otherSides.map((side) => `, ${side.label} participation ${side.participation}`).join('')
  );
}

/** A gap in the match record, in the words shown on the page and in the export. */
function gapText(gap: ParticipationGap): string {
  const problem = gap.kind === 'no-lineup' ? 'no lineup recorded' : 'no substitutions recorded';
  return `${gap.teamName} v ${gap.opponent} (${formatDate(gap.dateTime)}): ${problem}`;
}

interface ReportMeta {
  /** Who the report is for, e.g. "Rocky Gorge". */
  title: string;
  source: ReportSource;
  season?: string;
  gaps: ParticipationGap[];
}

function buildReport(breakdown: EligibilityBreakdown, { title, source, season, gaps }: ReportMeta): string {
  const lines: string[] = [];
  lines.push(`${title.toUpperCase()} ELIGIBILITY REPORT`);
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  if (season) lines.push(`Source: match record, ${season} season`);
  lines.push('');
  if (gaps.length > 0) {
    lines.push('RECORD GAPS (counts may be low; check these matches)');
    for (const gap of gaps) {
      lines.push(`  ${gapText(gap)}`);
    }
    lines.push('');
  }

  if (breakdown.sides.some((side) => side.summary.caution > 0)) {
    lines.push(`CAUTION: ${CAUTION_ADVICE}`, '');
  }

  const sameNames = source === 'record' ? sameNamePlayers(breakdown.sides) : [];
  if (sameNames.length > 0) {
    lines.push('PLAYERS WITH THE SAME NAME (kept separate; counts may be low if one person has two profiles)');
    for (const { name, ids } of sameNames) {
      lines.push(`  ${name}: CMS IDs ${ids.join(', ')}`);
    }
    lines.push('');
  }

  for (const side of breakdown.sides) {
    const shared = sharedNames(side.players);
    const eligible = side.players.filter((p) => p.eligible);
    const ineligible = side.players.filter((p) => !p.eligible);

    lines.push('='.repeat(46));
    lines.push(divisionLabel(side.label, side.teamName, side.summary));
    lines.push('='.repeat(46));
    lines.push('');
    lines.push(`ELIGIBLE (${eligible.length})`);
    if (eligible.length === 0) {
      lines.push('  (none)');
    } else {
      for (const player of eligible) {
        lines.push(`  ${reportPlayerLine(player, source, shared)}`);
        for (const note of player.cautions) {
          lines.push(`    • Caution: ${note}`);
        }
        for (const note of player.pending) {
          lines.push(`    • On track: ${note}`);
        }
      }
    }
    lines.push('');
    lines.push(`INELIGIBLE (${ineligible.length})`);
    if (ineligible.length === 0) {
      lines.push('  (none)');
    } else {
      for (const player of ineligible) {
        lines.push(`  ${reportPlayerLine(player, source, shared)}`);
        for (const reason of player.reasons) {
          lines.push(`    • ${reason}`);
        }
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

export interface EligibilityReportViewProps {
  source: ReportSource;
  /** Who the report is for, with the sides it covers. */
  club: Pick<Club, 'name' | 'sides'>;
  breakdown: EligibilityBreakdown;
  /** Gaps in the match record, shown as a warning. Empty for a CSV report. */
  gaps?: ParticipationGap[];
  /** What the player detail accounts each round from; null for a CSV report. */
  record?: PlayerRecordInput | null;
  /** Named in the exported report. */
  season?: string;
  /** Whether the players have pages of their own at the host's player route. */
  playerPages?: boolean;
  /** A Locked Season: every verdict is final, so there is no Caution to filter by. */
  locked?: boolean;
  /** Players who also played for another club that season, with those games. */
  transfers?: TransferRecords;
  /** Rugby Xplorer's own club slug. Match links use the council's path without one. */
  clubSlug?: string | null;
  /** The side on show, by its place in the breakdown. */
  activeSide: number;
  onActiveSideChange: (side: number) => void;
  /** Extra buttons beside Export Report. */
  actions?: ReactNode;
}

/** A club's verdicts, however they were worked out: notices, a tab for each side,
 *  and each side's table of players. */
export function EligibilityReportView({
  source,
  club,
  breakdown,
  gaps = [],
  record = null,
  season,
  playerPages = false,
  locked = false,
  transfers = {},
  clubSlug = null,
  activeSide,
  onActiveSideChange,
  actions,
}: EligibilityReportViewProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(['lastRegistered', 'played', 'sub']);

  const oneSide = club.sides.length === 1;
  const sameNames = source === 'record' ? sameNamePlayers(breakdown.sides) : [];
  const shownSide = Math.min(activeSide, breakdown.sides.length - 1);
  const side = breakdown.sides[shownSide] ?? null;

  const matchesFilters = (player: PlayerEligibility) => {
    if (statusFilter === 'eligible' && !player.eligible) return false;
    if (statusFilter === 'caution' && player.cautions.length === 0) return false;
    if (statusFilter === 'ineligible' && player.eligible) return false;
    return true;
  };
  const visiblePlayers = side ? side.players.filter(matchesFilters) : [];

  const handleExport = () => {
    const meta: ReportMeta = { title: club.name, source, season, gaps };
    const blob = new Blob([buildReport(breakdown, meta)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `eligibility-report-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <Tabs
            value={shownSide}
            onChange={(_, next: number) => onActiveSideChange(next)}
            aria-label="Eligibility by division"
            variant="scrollable"
            scrollButtons="auto"
          >
            {breakdown.sides.map((entry) => (
              <Tab key={entry.teamName} label={`${entry.label} side`} />
            ))}
          </Tabs>
        )}
        <Stack direction="row" spacing={1} useFlexGap sx={wrapRow}>
          {actions}
          <Button variant="outlined" size="small" onClick={handleExport}>
            Export Report
          </Button>
        </Stack>
      </Stack>
      {side && (
        <DivisionTable
          title={divisionLabel(side.label, side.teamName, side.summary)}
          source={source}
          ownLabel={side.label}
          otherLabels={breakdown.sides.filter((entry) => entry.teamName !== side.teamName).map((entry) => entry.label)}
          record={record}
          playerPages={playerPages}
          locked={locked}
          transfers={transfers}
          clubSlug={clubSlug}
          summary={side.summary}
          visibleCount={visiblePlayers.length}
          filtered={statusFilter !== 'all'}
          hiddenColumns={hiddenColumns}
          onHiddenColumnsChange={setHiddenColumns}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          players={visiblePlayers}
          allPlayers={side.players}
        />
      )}
    </Stack>
  );
}
