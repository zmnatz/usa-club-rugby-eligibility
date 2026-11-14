import {
  filterUnreported,
  formatDate,
  matchUrl,
  toggleUnreportedReason,
  type UnreportedFilters,
  type UnreportedGame,
  unreportedGameCount as gameCount,
  unreportedReasonText as reasonText,
  type UnreportedSide,
  unreportedSideTone,
  unreportedTone as toneOf,
  competitionLabel,
  DEFAULT_UNREPORTED,
} from '@zmnatz/usa-club-rugby-data';
import { type CSSProperties, useState } from 'react';
import { useEligibilityLinks } from './links.tsx';

// The filters and their wording are the data package's (`filterUnreported`), shared with
// the MUI package's list. Re-exported, so a host imports the list and its filters together.
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

/** The colour of the most serious gap a reason names a side for, or null when none does.
 *  The reason toggles wear the same colours, so they are the key. */
const sideTone = (game: UnreportedGame, side: UnreportedSide) => unreportedSideTone(game, side.teamName);

function Side({ side }: { side: UnreportedSide }) {
  const { Link, routes } = useEligibilityLinks();
  // The team, which says which of a club's sides played, shows on hover.
  return side.clubKey ? (
    <Link href={routes.club(side.clubKey)} title={side.teamName}>
      {side.clubName}
    </Link>
  ) : (
    <span title={side.teamName}>{side.clubName}</span>
  );
}

function GameRow({ game, showCompetition }: { game: UnreportedGame; showCompetition: boolean }) {
  return (
    <tr>
      {/* A missing result is the game's, not a side's, so it marks the date. */}
      <td
        data-label="Date"
        className={game.reasons.some((reason) => reason.kind === 'no-result') ? 'ec-flagged ec-flagged--info' : undefined}
      >
        <a href={matchUrl(game.fixtureId)} target="_blank" rel="noopener noreferrer">
          {formatDate(game.dateTime)}
        </a>
      </td>
      {showCompetition && <td data-label="Competition">{competitionLabel(game.competition)}</td>}
      {[game.home, game.away].map((side, index) => (
        <td
          key={side.teamName}
          data-label={index === 0 ? 'Home' : 'Away'}
          className={sideTone(game, side) ? `ec-flagged ec-flagged--${sideTone(game, side)}` : undefined}
        >
          <Side side={side} />
        </td>
      ))}
      <td data-label="Reason">
        <ul className="ec-reasons">
          {game.reasons.map((reason) => (
            <li key={reasonText(reason)} className={`ec-tone-${toneOf(reason.kind)}`}>
              {reasonText(reason)}
            </li>
          ))}
        </ul>
      </td>
    </tr>
  );
}

/** One table of games. Every table in the list shares its column widths. Without the
 *  grouping, it names each game's competition. On a narrow screen each game stacks into a
 *  card, its cells labelled from `data-label` (`ec-table-stack`). */
function GamesTable({ games, showCompetition }: { games: UnreportedGame[]; showCompetition: boolean }) {
  return (
    <div className="ec-table-wrap">
      <table className="ec-table ec-table-stack ec-unreported-table">
        <colgroup>
          <col className="ec-col-date" />
          {showCompetition && <col />}
          <col className="ec-col-club" />
          <col className="ec-col-club" />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>Date</th>
            {showCompetition && <th>Competition</th>}
            <th>Home</th>
            <th>Away</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game) => (
            <GameRow key={game.fixtureId} game={game} showCompetition={showCompetition} />
          ))}
        </tbody>
      </table>
    </div>
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
      <section className="ec-card">
        <p className="ec-muted">No games are overdue.</p>
      </section>
    );
  }

  const { shown, division, divisions, reasons, competitions, groups } = filterUnreported(games, current);
  const clubChars = Math.max(...games.flatMap((game) => [game.home.clubName.length, game.away.clubName.length]));

  return (
    <section
      className="ec-card ec-unreported"
      aria-labelledby="unreported-title"
      // Every group's table shares its column widths: the clubs' fit the longest club name
      // in the list, filtered or not, so they don't move as the filters change.
      style={{ '--ec-club-chars': clubChars } as CSSProperties}
    >
      <div className="ec-toolbar">
        <h2 id="unreported-title" aria-live="polite">
          {shown.length === games.length ? gameCount(games.length) : `${shown.length} of ${gameCount(games.length)}`}
        </h2>
        <div className="ec-controls">
          <label className="ec-field ec-inline">
            Division
            <select className="ec-input" value={division} onChange={(event) => change({ division: event.target.value })}>
              <option value="all">All divisions</option>
              {divisions.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="ec-field ec-inline">
            Competition
            <input
              className="ec-input"
              type="search"
              list="unreported-competitions"
              placeholder="Any competition"
              autoComplete="off"
              value={current.competition}
              onChange={(event) => change({ competition: event.target.value })}
            />
            <datalist id="unreported-competitions">
              {competitions.map(({ name, label }) => (
                <option key={name} value={label} />
              ))}
            </datalist>
          </label>
          <fieldset className="ec-segmented">
            <legend className="ec-sr">Reasons</legend>
            <label>
              <input
                type="checkbox"
                value="all"
                checked={current.reasons.length === 0}
                onChange={() => change({ reasons: [] })}
              />
              All
            </label>
            {reasons.map(([kind, label]) => (
              <label key={kind} className={`ec-tone-${toneOf(kind)}`}>
                <input
                  type="checkbox"
                  value={kind}
                  checked={current.reasons.includes(kind)}
                  onChange={(event) =>
change({ reasons: toggleUnreportedReason(current.reasons, kind, event.target.checked) })
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
        </div>
      </div>
      <div className="ec-row ec-group-controls">
        <label className="ec-small">
          <input type="checkbox" checked={grouped} onChange={(event) => setGrouped(event.target.checked)} /> Group by
          competition
        </label>
        {/* Disabled rather than hidden without the grouping, so the row keeps its height. */}
        <button type="button" className="ec-btn" disabled={!grouped} onClick={() => setCollapsed(new Set())}>
          Expand all
        </button>
        <button
          type="button"
          className="ec-btn"
          disabled={!grouped}
          onClick={() => setCollapsed(new Set(competitions.map(({ name }) => name)))}
        >
          Collapse all
        </button>
      </div>
      {shown.length === 0 && <p className="ec-muted">No games match these filters.</p>}
      {!grouped && shown.length > 0 && <GamesTable games={shown} showCompetition />}
      {grouped &&
        groups.map((group) => (
          <details
            key={group.name}
            className="ec-details ec-group"
            open={!collapsed.has(group.name)}
            onToggle={(event) => setOpen(group.name, event.currentTarget.open)}
          >
            <summary className="ec-group-title">
              {group.label} <span className="ec-muted ec-small">({gameCount(group.games.length)})</span>
            </summary>
            <GamesTable games={group.games} showCompetition={false} />
          </details>
        ))}
    </section>
  );
}
