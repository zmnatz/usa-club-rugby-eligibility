import { type ReactNode, useState } from 'react';
import {
  buildReport,
  CAUTION_ADVICE,
  type Club,
  divisionLabel,
  filterPlayers,
  type EligibilityBreakdown,
  gapText,
  getColumns,
  hasSharedName,
  isNameWithheld,
  otherSideCount,
  type ParticipationGap,
  type PlayerEligibility,
  type ReportColumn,
  type ReportMeta,
  type ReportSource,
  type SortDirection,
  type SortKey,
  type StatusFilter,
  sameNamePlayers,
  sharedNames,
  sortPlayers,
  type TransferRecords,
} from '@zmnatz/usa-club-rugby-data';
import { EligibilityStatusChip, WaiverChip } from './EligibilityStatusChip.tsx';
import { useEligibilityLinks } from './links.tsx';
import { FIRST_PLAYER_ID } from './SkipToFirstPlayer.tsx';

/** The columns a visitor can show or hide; the rest are always shown. */
const OPTIONAL_COLUMNS: SortKey[] = ['lastRegistered', 'played', 'sub'];

interface SideTableProps {
  index: number;
  breakdown: EligibilityBreakdown;
  source: ReportSource;
  locked: boolean;
  playerHref?: (playerId: string) => string;
  transfers: TransferRecords;
}

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
        <Link className="ec-player" href={playerHref(player.playerId)}>
          {player.name}
        </Link>
      ) : (
        <strong>{player.name}</strong>
      )}
      {source === 'csv' && <div className="ec-caption ec-muted">USA ID {player.playerId}</div>}
      {source === 'record' && showCmsId && <div className="ec-caption ec-muted">CMS ID {player.playerId}</div>}
    </>
  );
}

function cellContent(
  player: PlayerEligibility,
  key: SortKey,
  context: {
    source: ReportSource;
    showCmsId: boolean;
    playerHref?: (playerId: string) => string;
    moved: boolean;
  },
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
        <span className="ec-row" style={{ gap: 4 }}>
          <EligibilityStatusChip player={player} />
          {context.moved && <WaiverChip />}
        </span>
      );
    case 'reasons':
      return player.reasons.length === 0 ? (
        <span className="ec-muted">{[...player.cautions, ...player.pending].join(' · ') || '—'}</span>
      ) : (
        player.reasons.join(' · ')
      );
    default:
      return otherSideCount(player, key);
  }
}

// An optional column's class hides it. The reasons' keeps their text readable on a narrow
// screen, where the table scrolls sideways.
const columnClass = (column: ReportColumn) =>
  [
    OPTIONAL_COLUMNS.includes(column.key) ? `col-${column.key}` : '',
    column.key === 'reasons' ? 'ec-text-cell' : '',
    column.numeric ? 'ec-num' : '',
  ]
    .filter(Boolean)
    .join(' ') || undefined;

/** One side's players: a status filter, a column chooser that works with CSS alone, and
 *  a table sorted by a column's header. */
function SideTable({ index, breakdown, source, locked, playerHref, transfers }: SideTableProps) {
  const side = breakdown.sides[index];
  const { summary } = side;
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'name', direction: 'asc' });
  const [status, setStatus] = useState<StatusFilter>('all');
  const players = filterPlayers(sortPlayers(side.players, sort.key, sort.direction), status);
  const sortBy = (key: SortKey) =>
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  const otherLabels = breakdown.sides.filter((entry) => entry.teamName !== side.teamName).map((entry) => entry.label);
  const columns = getColumns(otherLabels, source);
  // From the whole side, so the id shows for both of a pair of same-named players.
  const shared = sharedNames(side.players);
  const filters: [StatusFilter, string][] = [
    ['all', 'All'],
    ['eligible', 'Eligible'],
    ...(locked ? [] : [['caution', 'Caution'] as [StatusFilter, string]]),
    ['ineligible', 'Ineligible'],
  ];

  return (
    <section className="ec-card ec-side" id={`side-${index}`} aria-labelledby={`side-${index}-title`}>
      <div className="ec-toolbar">
        <h2 id={`side-${index}-title`}>{divisionLabel(side.label, side.teamName, summary)}</h2>
        <div className="ec-controls">
          <fieldset className="ec-segmented">
            <legend className="ec-sr">Eligibility status</legend>
            {filters.map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name={`status-${index}`}
                  value={value}
                  checked={status === value}
                  onChange={() => setStatus(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <span
            className={`ec-chip ec-chip--${summary.eligible === summary.total ? 'success' : summary.total === 0 ? 'default' : 'warning'}`}
          >
            {`${summary.eligible} of ${summary.total} eligible${summary.onTrack > 0 ? `, ${summary.onTrack} on track` : ''}${summary.caution > 0 ? `, ${summary.caution} caution` : ''}`}
          </span>
          <details className="ec-columns">
            <summary>Columns</summary>
            <div>
              {columns
                .filter((column) => OPTIONAL_COLUMNS.includes(column.key))
                .map((column) => (
                  <label key={column.key}>
                    <input type="checkbox" data-col={column.key} /> {column.title}
                  </label>
                ))}
            </div>
          </details>
        </div>
      </div>
      <div className="ec-table-wrap">
        {/* Sorted by its headers, so it stays a table on a narrow screen, the player's name
            held at the left as the rest scrolls. */}
        <table className="ec-table ec-table-sticky">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={columnClass(column)}
                  aria-sort={column.key === sort.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <button type="button" onClick={() => sortBy(column.key)}>
                    {column.title}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((player, row) => (
              <tr
                key={player.playerId}
                // The skip link lands on the first row, whichever that is after a sort.
                id={index === 0 && row === 0 ? FIRST_PLAYER_ID : undefined}
                tabIndex={index === 0 && row === 0 ? -1 : undefined}
              >
                {columns.map((column) => (
                  <td key={column.key} className={columnClass(column)}>
                    {cellContent(player, column.key, {
                      source,
                      showCmsId: hasSharedName(player, shared),
                      playerHref,
                      moved: player.playerId in transfers,
                    })}
                  </td>
                ))}
              </tr>
            ))}
            {players.length === 0 && (
              <tr id={index === 0 ? FIRST_PLAYER_ID : undefined} tabIndex={index === 0 ? -1 : undefined}>
                <td colSpan={columns.length} className="ec-center ec-muted">
                  {side.players.length === 0 ? 'No players in this team’s report.' : 'No players match this filter.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
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
    <div className="ec-stack">
      {oneSide && (
        <p className="ec-muted ec-small" style={{ margin: 0 }}>
          Only one of this club&apos;s sides is in the data, so it is assessed as a one-side club:
          two qualifying matches, and no other side to compare.
        </p>
      )}

      {gaps.length > 0 && (
        <div className="ec-alert ec-alert--warning">
          These matches have gaps in the record, so some counts may be low. Check them
          before relying on a verdict:
          <ul>
            {gaps.map((gap) => (
              <li key={`${gap.fixtureId}-${gap.teamName}`}>{gapText(gap)}</li>
            ))}
          </ul>
        </div>
      )}

      {sameNames.length > 0 && (
        <div className="ec-alert ec-alert--info">
          These players share a name, so they are kept separate. If one person has two Rugby
          Xplorer profiles, their matches stay split until the profiles are merged, and each count
          may be low:
          <ul>
            {sameNames.map(({ name, ids }) => (
              <li key={name}>
                {name}: CMS IDs {ids.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {breakdown.ignoredTeamNames.length > 0 && (
        <div className="ec-alert ec-alert--info">
          Ignored rows for team(s) that aren&apos;t one of this club&apos;s NCS sides:{' '}
          {breakdown.ignoredTeamNames.join(', ')}.
        </div>
      )}

      {breakdown.sides.some((entry) => entry.summary.caution > 0) && (
        <div className="ec-alert ec-alert--warning">
          Caution marks players one upper-side match from losing a side for the rest of the
          season. {CAUTION_ADVICE}
        </div>
      )}

      <div className="ec-row ec-spread">
        {oneSide ? (
          <span />
        ) : (
          <nav className="ec-sidenav" aria-label="Eligibility by division">
            {breakdown.sides.map((entry, index) => (
              <a key={entry.teamName} href={`#side-${index}`}>
                {entry.label} side
              </a>
            ))}
          </nav>
        )}
        <div className="ec-row">
          {actions}
          <button type="button" className="ec-btn" onClick={exportReport}>
            Export Report
          </button>
        </div>
      </div>

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
    </div>
  );
}
