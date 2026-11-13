import {
  formatDate,
  matchUrl,
  type UnreportedGame,
  type UnreportedReason,
  type UnreportedSide,
} from '@zmnatz/usa-club-rugby-data';
import { useState } from 'react';
import { useEligibilityLinks } from './links.tsx';

/** What the list is filtered to: a competition name or reason kind, or `all`. */
export interface UnreportedFilters {
  competition: string;
  reason: string;
}

export const ALL_UNREPORTED: UnreportedFilters = { competition: 'all', reason: 'all' };

export interface UnreportedGamesProps {
  games: UnreportedGame[];
  /** The filters, for a host that keeps them, e.g. in the URL. Without them the list keeps
   *  its own, starting from `ALL_UNREPORTED`. A value the games don't offer reads as `all`. */
  filters?: UnreportedFilters;
  onFiltersChange?: (filters: UnreportedFilters) => void;
}

/** How a side's division reads in its row. */
const DIVISIONS: [string, string][] = [
  ['M1', "Men's D1"],
  ['M2', "Men's D2"],
  ['M3', "Men's D3"],
  ['W1', "Women's D1"],
  ['W2', "Women's D2"],
];

const REASONS: [UnreportedReason['kind'], string][] = [
  ['no-result', 'No result'],
  ['no-lineup', 'No lineup'],
  ['no-substitutions', 'No substitutions'],
];

const divisionLabel = (code: string) => DIVISIONS.find(([value]) => value === code)?.[1] ?? code;

const gameCount = (count: number) => (count === 1 ? '1 game' : `${count} games`);

function reasonText(reason: UnreportedReason): string {
  if (reason.kind === 'no-result') return 'No result entered';
  const label = REASONS.find(([kind]) => kind === reason.kind)?.[1];
  return `${label}: ${reason.teamName}`;
}

/** Whether a side is the one a lineup or substitutions reason names. A missing result is
 *  the game's, so it marks neither side. */
const hasGap = (game: UnreportedGame, side: UnreportedSide) =>
  game.reasons.some((reason) => reason.kind !== 'no-result' && reason.teamName === side.teamName);

function Side({ side }: { side: UnreportedSide }) {
  const { Link, routes } = useEligibilityLinks();
  return (
    <>
      {side.clubKey ? <Link href={routes.club(side.clubKey)}>{side.clubName}</Link> : side.clubName}
      <div className="ec-muted ec-small">{side.teamName}</div>
    </>
  );
}

function GameRow({ game }: { game: UnreportedGame }) {
  return (
    <tr>
      <td>
        <a href={matchUrl(game.fixtureId)} target="_blank" rel="noopener noreferrer">
          {formatDate(game.dateTime)}
        </a>
      </td>
      {[game.home, game.away].map((side) => (
        <td key={side.teamName} className={hasGap(game, side) ? 'ec-flagged' : undefined}>
          <Side side={side} />
        </td>
      ))}
      <td>
        {game.divisions.map(divisionLabel).join(' / ') || '—'}
      </td>
      <td>
        <ul className="ec-reasons">
          {game.reasons.map((reason) => (
            <li key={reasonText(reason)}>{reasonText(reason)}</li>
          ))}
        </ul>
      </td>
    </tr>
  );
}

/** Current-season games whose record still needs entering, in a collapsible group per
 *  competition, filterable by competition and reason. */
export function UnreportedGames({ games, filters, onFiltersChange }: UnreportedGamesProps) {
  const [own, setOwn] = useState(ALL_UNREPORTED);
  const current = filters ?? own;
  const change = (next: Partial<UnreportedFilters>) => (onFiltersChange ?? setOwn)({ ...current, ...next });

  if (games.length === 0) {
    return (
      <section className="ec-card">
        <p className="ec-muted">No games are overdue.</p>
      </section>
    );
  }

  const competitions = [...new Set(games.map((game) => game.competition))]
    .sort((a, b) => a.localeCompare(b))
    .map((name): [string, string] => [name, name]);
  const reasons = REASONS.filter(([kind]) => games.some((game) => game.reasons.some((entry) => entry.kind === kind)));
  const offered = (value: string, options: [string, string][]) =>
    options.some(([option]) => option === value) ? value : 'all';
  const competition = offered(current.competition, competitions);
  const reason = offered(current.reason, reasons);
  const shown = games.filter(
    (game) =>
      (competition === 'all' || game.competition === competition) &&
      (reason === 'all' || game.reasons.some((entry) => entry.kind === reason)),
  );
  const groups = competitions
    .map(([name]) => ({ name, games: shown.filter((game) => game.competition === name) }))
    .filter((group) => group.games.length > 0);

  return (
    <section className="ec-card ec-unreported" aria-labelledby="unreported-title">
      <div className="ec-toolbar">
        <h2 id="unreported-title" aria-live="polite">
          {shown.length === games.length ? gameCount(games.length) : `${shown.length} of ${gameCount(games.length)}`}
        </h2>
        <div className="ec-controls">
          <label className="ec-field ec-inline">
            Competition
            <select
              className="ec-input"
              value={competition}
              onChange={(event) => change({ competition: event.target.value })}
            >
              <option value="all">All competitions</option>
              {competitions.map(([name]) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="ec-segmented">
            <legend className="ec-sr">Reason</legend>
            {[['all', 'All'], ...reasons].map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="unreported-reason"
                  value={value}
                  checked={reason === value}
                  onChange={() => change({ reason: value })}
                />
                {label}
              </label>
            ))}
          </fieldset>
        </div>
      </div>
      {groups.length === 0 && <p className="ec-muted">No games match these filters.</p>}
      {groups.map((group) => (
        <details key={group.name} className="ec-details ec-group" open>
          <summary className="ec-group-title">
            {group.name} <span className="ec-muted ec-small">({gameCount(group.games.length)})</span>
          </summary>
          <div className="ec-table-wrap">
            <table className="ec-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Home</th>
                  <th>Away</th>
                  <th>Division</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {group.games.map((game) => (
                  <GameRow key={game.fixtureId} game={game} />
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </section>
  );
}
