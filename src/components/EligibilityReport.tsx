import { useMemo, useState, type ChangeEvent } from 'react';
import NextLink from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Autocomplete,
  Button,
  Checkbox,
  Chip,
  InputLabel,
  Link as MuiLink,
  ListItemText,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Dialog,
  DialogTitle,
} from '@mui/material';
import {
  CAUTION_ADVICE,
  PlayerEligibilityDialog,
  type ReportSource,
} from '@/components/PlayerEligibilityDialog';
import {
  BoldCell,
  ClickableRow,
  ColumnsControl,
  EmptyCell,
  FileButton,
  FormDialogContent,
  Panel,
  PlainList,
  Row,
} from '@/theme';
import { EligibilityStatusChip } from '@/components/EligibilityStatusChip';
import {
  type Club,
  clubGaps,
  clubsInRows,
  computeBreakdown,
  DEFAULT_RULES as eligibility,
  divisionLabel,
  type EligibilityBreakdown,
  type FeedFixture,
  fetchMatchCentre,
  hasSharedName,
  isNameWithheld,
  loadClubRecord,
  parsePlayerRows,
  type PublishedClub,
  type ParticipationGap,
  participationRows,
  type ParticipationSnapshot,
  type PlayerEligibility,
  type PlayerRecordInput,
  type PlayerRow,
  qualifyingRows,
  remainingMatches,
  sameNamePlayers,
  sharedNames,
} from '@zmnatz/usa-club-rugby-data';
import { loadFixtures } from '@/utils/data';
import { playerPath } from '@/utils/paths';
import { formatDate, formatDateTime } from '@/utils/dates';
import { compareValues, type SortDirection } from '@/utils/sort';


// Deployed pages pull live; dev uses the saved snapshot so working on the page
// doesn't hit the CMS.
const LIVE_RECORD = process.env.NODE_ENV === 'production';
const LIVE_RECORD_STALE_MS = 10 * 60 * 1000;

/** A club's page: its saved match record and fixtures, from the nightly data at
 *  build time, topped up live. A CSV page: whatever report is uploaded. */
export type EligibilityReportProps =
  | { source: 'record'; club: PublishedClub; saved: ParticipationSnapshot; fixtures: FeedFixture[] }
  | { source: 'csv' };

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
      if (!player.eligible) return 0;
      if (player.cautions.length > 0) return 1;
      return player.pending.length > 0 ? 2 : 3;
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

function renderCell(player: PlayerEligibility, key: SortKey, source: ReportSource, showCmsId: boolean) {
  switch (key) {
    case 'name':
      return (
        <>
          <Typography variant="body2" component="strong">
            {player.name}
          </Typography>
          {source === 'csv' && (
            <Typography variant="caption" color="text.secondary">
              USA ID {player.playerId}
            </Typography>
          )}
          {source === 'record' && showCmsId && (
            <Typography variant="caption" color="text.secondary">
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
      return <EligibilityStatusChip player={player} />;
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
    <Panel>
      <Row between below={2}>
        <Row>
          <Typography variant="h6" component="h2">
            {title}
          </Typography>
          {filtered && (
            <Typography variant="caption" color="text.secondary">
              Showing {visibleCount} of {summary.total}
            </Typography>
          )}
        </Row>
        <Row gap={1.5}>
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
            <ToggleButton value="caution">Caution</ToggleButton>
            <ToggleButton value="ineligible">Ineligible</ToggleButton>
          </ToggleButtonGroup>
          <Chip
            size="small"
            color={summary.eligible === summary.total ? 'success' : summary.total === 0 ? 'default' : 'warning'}
            label={`${summary.eligible} of ${summary.total} eligible${summary.onTrack > 0 ? `, ${summary.onTrack} on track` : ''}${summary.caution > 0 ? `, ${summary.caution} caution` : ''}`}
          />
          <ColumnsControl size="small">
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
          </ColumnsControl>
        </Row>
      </Row>
      <TableContainer>
        <Table size="small">
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
            {rows.map((player) => (
              <ClickableRow key={player.playerId} hover onClick={() => setDetail(player)}>
                {visibleColumns.map((col) => {
                  const Cell = col.key === 'participation' ? BoldCell : TableCell;
                  return (
                    <Cell key={col.key} align={col.numeric ? 'right' : 'left'}>
                      {renderCell(player, col.key, source, hasSharedName(player, shared))}
                    </Cell>
                  );
                })}
              </ClickableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <EmptyCell colSpan={visibleColumns.length} align="center">
                  {filtered
                    ? 'No players match the current filters.'
                    : `No players in this team's report.`}
                </EmptyCell>
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
        pageHref={detail && playerPages && !isNameWithheld(detail.name) ? playerPath(detail.playerId) : undefined}
        showCmsId={detail !== null && hasSharedName(detail, shared)}
        onClose={() => setDetail(null)}
      />
    </Panel>
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

interface CsvFormProps {
  csvText: string;
  fileName: string;
  canClear: boolean;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onTextChange: (value: string) => void;
  onRun: () => void;
  onClear: () => void;
}

function CsvForm({ csvText, fileName, canClear, onFile, onTextChange, onRun, onClear }: CsvFormProps) {
  return (
    <>
      <Row gap={2} stretch below={2}>
        <FileButton variant="outlined" component="label">
          Choose CSV file…
          <input type="file" accept=".csv,text/csv" hidden onChange={onFile} />
        </FileButton>
        <TextField
          label="…or paste the CSV"
          multiline
          minRows={6}
          maxRows={14}
          fullWidth
          value={csvText}
          onChange={(event) => onTextChange(event.target.value)}
        />
      </Row>
      <Row gap={2}>
        <Button variant="contained" onClick={onRun} disabled={!csvText.trim()}>
          Run Breakdown
        </Button>
        <Button variant="text" onClick={onClear} disabled={!canClear}>
          Clear
        </Button>
        {fileName && (
          <Typography variant="body2" color="text.secondary">
            Loaded: {fileName}
          </Typography>
        )}
      </Row>
    </>
  );
}

export function EligibilityReport(props: EligibilityReportProps) {
  const source: ReportSource = props.source;
  const [csvClubName, setCsvClubName] = useState('');
  const [fileName, setFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [csvRows, setCsvRows] = useState<PlayerRow[] | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(['lastRegistered', 'played', 'sub']);

  // A CSV report can be for any club, so its page loads the national fixture list
  // for possible fixtures; a club's page has its fixtures already.
  const csvSchedule = useQuery({
    queryKey: ['eligibility-fixtures'],
    queryFn: loadFixtures,
    enabled: props.source === 'csv',
  });
  const fixtures: FeedFixture[] | undefined = props.source === 'record' ? props.fixtures : csvSchedule.data;
  const csvClubs = useMemo(() => (csvRows ? clubsInRows(csvRows) : []), [csvRows]);
  const club: Club | null =
    props.source === 'record'
      ? props.club
      : (csvClubs.find((candidate) => candidate.name === csvClubName) ?? (csvClubs.length === 1 ? csvClubs[0] : null));
  const record = useQuery({
    queryKey: ['eligibility-record', club?.name],
    queryFn: () =>
      props.source === 'record'
        ? loadClubRecord(props.club, {
            live: LIVE_RECORD,
            fixtures: props.fixtures,
            fetchMatch: fetchMatchCentre,
            loadSaved: async () => props.saved,
          })
        : Promise.reject(new Error('No match record for a CSV report.')),
    enabled: props.source === 'record',
    staleTime: LIVE_RECORD_STALE_MS,
    retry: false,
  });
  // The saved data shows straight away; a live pull replaces it when it lands.
  const clubRecord = record.data ?? null;
  // Rugby Xplorer's own club slug, for match-report links. The national data
  // doesn't publish one per club, so links fall back to the council's path.
  const xplorerClubSlug: string | null = null;
  const snapshot = clubRecord?.snapshot ?? (props.source === 'record' ? props.saved : null);

  const breakdown = useMemo(() => {
    if (!club) return null;
    // Fixtures not loaded (yet) are unknown, which isn't the same as none left.
    const remaining = fixtures ? remainingMatches(fixtures, club, eligibility) : {};
    if (source === 'csv') {
      return csvRows && computeBreakdown(qualifyingRows(csvRows, eligibility), club.sides, eligibility, remaining);
    }
    return snapshot
      ? computeBreakdown(participationRows(snapshot, club, eligibility), club.sides, eligibility, remaining)
      : null;
  }, [source, club, csvRows, snapshot, fixtures]);
  const gaps = useMemo(
    () => (source === 'record' && snapshot && club ? clubGaps(snapshot, club, eligibility) : []),
    [source, snapshot, club],
  );
  const oneSide = club?.sides.length === 1;
  const sameNames = source === 'record' && breakdown ? sameNamePlayers(breakdown.sides) : [];
  const playerRecord: PlayerRecordInput | null =
    source === 'record' && snapshot && club ? { club, snapshot, fixtures: fixtures ?? [] } : null;
  const activeSide = breakdown?.sides[Math.min(activeTab, breakdown.sides.length - 1)] ?? null;

  const matchesFilters = (player: PlayerEligibility) => {
    if (statusFilter === 'eligible' && !player.eligible) return false;
    if (statusFilter === 'caution' && player.cautions.length === 0) return false;
    if (statusFilter === 'ineligible' && player.eligible) return false;
    return true;
  };

  const visiblePlayers = activeSide ? activeSide.players.filter(matchesFilters) : [];
  const filtersActive = statusFilter !== 'all';

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result ?? ''));
      setFileName(file.name);
      setError(null);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleRun = () => {
    setError(null);
    try {
      setCsvRows(parsePlayerRows(csvText));
      setDialogOpen(false);
    } catch (err) {
      setCsvRows(null);
      setError(err instanceof Error ? err.message : 'Could not read the CSV.');
      setDialogOpen(false);
    }
  };

  const handleClear = () => {
    setCsvText('');
    setFileName('');
    setError(null);
    setCsvRows(null);
    setStatusFilter('all');
    setHiddenColumns(['lastRegistered', 'played', 'sub']);
    setDialogOpen(false);
  };

  const handleExport = () => {
    if (!breakdown) return;
    const meta: ReportMeta = {
      title: club?.name ?? 'Club',
      source,
      season: source === 'record' ? snapshot?.season : undefined,
      gaps,
    };
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

  const savedAsOf = props.source === 'record' ? props.saved.generatedAt : undefined;
  const shownSource = clubRecord?.source ?? 'saved';
  const shownAsOf = clubRecord?.asOf ?? savedAsOf;

  return (
    <>
      <Typography color="text.secondary" gutterBottom>
        {source === 'record'
          ? `Counted from the lineups and substitutions entered in Rugby Xplorer for every
             senior club league and local playoff match. Fixtures still to play before Super
             Regionals count towards the two-match minimums, shown as on track (experimental).
             A player one upper-side match from losing a side for the season is shown as caution
             (experimental). Click a player to check their count round by round against the Rugby Xplorer match
             reports. This is a guide: the Rugby Xplorer Match Participation Report is the
             official count, and registration isn't checked.`
          : `Paste or upload a Rugby Xplorer Match Participation Report for any club to see
             which players are NCS-eligible for each of its sides. Participation counts as
             Played + Substitute. Players are assumed registered, since the report only lists
             registered players, and the registration date is shown for reference.`}{' '}
        <MuiLink component={NextLink} href="/methodology">
          How this report is worked out
        </MuiLink>
      </Typography>

      <Row gap={2} below={3}>
        {source === 'csv' && csvClubs.length > 1 && (
          <Autocomplete
            size="small"
            options={csvClubs}
            value={club}
            onChange={(_, next) => {
              setCsvClubName(next?.name ?? '');
              setActiveTab(0);
            }}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.name === value.name}
            renderInput={(params) => <TextField {...params} label={`Club in this report (${csvClubs.length})`} />}
          />
        )}
        {source === 'record' && snapshot && (
          <Typography variant="body2" color="text.secondary">
            {snapshot.season} season · {shownSource === 'live' ? 'Live data' : 'Nightly data'}
            {shownAsOf &&
              ` ${shownSource === 'live' ? 'from' : 'last changed'} ${formatDateTime(shownAsOf)}`}
            {record.isFetching && ' · checking for newer matches…'}
          </Typography>
        )}
      </Row>

      {source === 'record' && record.isError && (
        <Alert severity="warning">
          Couldn&apos;t check for matches since the nightly data, so this shows the nightly data.
        </Alert>
      )}

      {source === 'record' && clubRecord?.liveFailed && (
        <Alert severity="warning">
          The live pull failed, so this report uses saved data and may miss recent matches.
        </Alert>
      )}

      {oneSide && (
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Only one of this club&apos;s sides is in the data, so it is assessed as a one-side club:
          two qualifying matches, and no other side to compare.
        </Typography>
      )}

      {gaps.length > 0 && (
        <Alert severity="warning">
          These matches have gaps in the record, so some counts may be low. Check them
          before relying on a verdict:
          <PlainList>
            {gaps.map((gap) => (
              <li key={`${gap.fixtureId}-${gap.teamName}`}>{gapText(gap)}</li>
            ))}
          </PlainList>
        </Alert>
      )}

      {sameNames.length > 0 && (
        <Alert severity="info">
          These players share a name, so they are kept separate. If one person has two Rugby
          Xplorer profiles, their matches stay split until the profiles are merged, and each count
          may be low:
          <PlainList>
            {sameNames.map(({ name, ids }) => (
              <li key={name}>
                {name}: CMS IDs {ids.join(', ')}
              </li>
            ))}
          </PlainList>
        </Alert>
      )}

      {source === 'csv' && !breakdown && (
        <Panel pad={3} below={4}>
          <CsvForm
            csvText={csvText}
            fileName={fileName}
            canClear={Boolean(csvText)}
            onFile={handleFile}
            onTextChange={(value) => {
              setCsvText(value);
              setFileName('');
            }}
            onRun={handleRun}
            onClear={handleClear}
          />
        </Panel>
      )}

      {source === 'csv' && error && (
        <Alert severity="error">
          {error}
        </Alert>
      )}

      {breakdown && breakdown.ignoredTeamNames.length > 0 && (
        <Alert severity="info">
          Ignored rows for team(s) that aren&apos;t one of this club&apos;s NCS sides:{' '}
          {breakdown.ignoredTeamNames.join(', ')}.
        </Alert>
      )}

      {breakdown?.sides.some((side) => side.summary.caution > 0) && (
        <Alert severity="warning">
          Caution marks players one upper-side match from losing a side for the rest of the
          season. {CAUTION_ADVICE}
        </Alert>
      )}

      {source === 'csv' && !breakdown && !error && (
        <Typography color="text.secondary">
          Upload a report and run the breakdown to see player eligibility.
        </Typography>
      )}

      {breakdown && (
        <>
          <Row between gap={2} below={2}>
            {oneSide ? (
              <div />
            ) : (
              <Tabs
                value={Math.min(activeTab, breakdown.sides.length - 1)}
                onChange={(_, newValue) => setActiveTab(newValue)}
                aria-label="Eligibility by division"
                variant="scrollable"
                scrollButtons="auto"
              >
                {breakdown.sides.map((side) => (
                  <Tab key={side.teamName} label={`${side.label} side`} />
                ))}
              </Tabs>
            )}
            <Row>
              {source === 'csv' && (
                <Button variant="outlined" size="small" onClick={() => setDialogOpen(true)}>
                  Edit Report Data
                </Button>
              )}
              <Button variant="outlined" size="small" onClick={handleExport}>
                Export Report
              </Button>
            </Row>
          </Row>
          {activeSide && (
            <DivisionTable
              title={divisionLabel(activeSide.label, activeSide.teamName, activeSide.summary)}
              source={source}
              ownLabel={activeSide.label}
              otherLabels={breakdown.sides
                .filter((side) => side.teamName !== activeSide.teamName)
                .map((side) => side.label)}
              record={playerRecord}
              playerPages={props.source === 'record'}
              summary={activeSide.summary}
              visibleCount={visiblePlayers.length}
              filtered={filtersActive}
              hiddenColumns={hiddenColumns}
              onHiddenColumnsChange={setHiddenColumns}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              players={visiblePlayers}
              allPlayers={activeSide.players}
            />
          )}
        </>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Report Data</DialogTitle>
        <FormDialogContent dividers>
          <CsvForm
            csvText={csvText}
            fileName={fileName}
            canClear={Boolean(csvText) || Boolean(csvRows)}
            onFile={handleFile}
            onTextChange={(value) => {
              setCsvText(value);
              setFileName('');
            }}
            onRun={handleRun}
            onClear={handleClear}
          />
        </FormDialogContent>
      </Dialog>
    </>
  );
}