import {
  competitionLabel,
  formatDate,
  matchUrl,
  type UnreportedGame,
  type UnreportedReason,
  type UnreportedSide,
} from '@zmnatz/usa-club-rugby-data';
import { useState } from 'react';
import { useEligibilityLinks } from './links.tsx';

export type UnreportedReasonKind = UnreportedReason['kind'];

/** What the list is filtered to: a division code, or `all`; text a competition's name must
 *  contain, or none; and the reasons shown, each turned on or off on its own. A game shows
 *  when any of its reasons is on. */
export interface UnreportedFilters {
  division: string;
  competition: string;
  reasons: UnreportedReasonKind[];
}

/** Where the list starts: games with no lineup, the gap that most affects eligibility. */
export const DEFAULT_UNREPORTED: UnreportedFilters = { division: 'all', competition: '', reasons: ['no-lineup'] };

export interface UnreportedGamesProps {
  games: UnreportedGame[];
  /** The filters, for a host that keeps them, e.g. in the URL. Without them the list keeps
   *  its own, starting from `DEFAULT_UNREPORTED`. A division the games don't offer reads
   *  as `all`. */
  filters?: UnreportedFilters;
  onFiltersChange?: (filters: UnreportedFilters) => void;
}

/** The divisions, in order, as the filter and each row show them. */
const DIVISIONS: [string, string][] = [
  ['M1', "Men's D1"],
  ['M2', "Men's D2"],
  ['M3', "Men's D3"],
  ['W1', "Women's D1"],
  ['W2', "Women's D2"],
];

/** Every reason, in the order the toggles show them. */
export const UNREPORTED_REASONS: [UnreportedReasonKind, string][] = [
  ['no-result', 'No result'],
  ['no-lineup', 'No lineup'],
  ['no-substitutions', 'No substitutions'],
];

const divisionLabel = (code: string) => DIVISIONS.find(([value]) => value === code)?.[1] ?? code;

const gameCount = (count: number) => (count === 1 ? '1 game' : `${count} games`);

function reasonText(reason: UnreportedReason): string {
  if (reason.kind === 'no-result') return 'No result entered';
  const label = UNREPORTED_REASONS.find(([kind]) => kind === reason.kind)?.[1];
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
 *  competition, filterable by division, competition and reasons. */
export function UnreportedGames({ games, filters, onFiltersChange }: UnreportedGamesProps) {
  const [own, setOwn] = useState(DEFAULT_UNREPORTED);
  const current = filters ?? own;
  const change = (next: Partial<UnreportedFilters>) => (onFiltersChange ?? setOwn)({ ...current, ...next });

  if (games.length === 0) {
    return (
      <section className="ec-card">
        <p className="ec-muted">No games are overdue.</p>
      </section>
    );
  }

  // Shown, suggested and matched without the year every current-season competition shares.
  const competitions = [...new Set(games.map((game) => game.competition))]
    .map((name) => ({ name, label: competitionLabel(name) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const divisions = DIVISIONS.filter(([code]) => games.some((game) => game.divisions.includes(code)));
  const reasons = UNREPORTED_REASONS.filter(([kind]) =>
    games.some((game) => game.reasons.some((entry) => entry.kind === kind)),
  );
  const division = divisions.some(([code]) => code === current.division) ? current.division : 'all';
  const competition = current.competition.trim().toLowerCase();
  const shown = games.filter(
    (game) =>
      (division === 'all' || game.divisions.includes(division)) &&
      competitionLabel(game.competition).toLowerCase().includes(competition) &&
      game.reasons.some((entry) => current.reasons.includes(entry.kind)),
  );
  const groups = competitions
    .map(({ name, label }) => ({ name, label, games: shown.filter((game) => game.competition === name) }))
    .filter((group) => group.games.length > 0);

  return (
    <section className="ec-card ec-unreported" aria-labelledby="unreported-title">
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
          <fieldset className="ec-segmented ec-toggles">
            <legend className="ec-sr">Reasons</legend>
            {reasons.map(([kind, label]) => (
              <label key={kind}>
                <input
                  type="checkbox"
                  value={kind}
                  checked={current.reasons.includes(kind)}
                  onChange={(event) =>
                    change({
                      reasons: UNREPORTED_REASONS.map(([option]) => option).filter((option) =>
                        option === kind ? event.target.checked : current.reasons.includes(option),
                      ),
                    })
                  }
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
            {group.label} <span className="ec-muted ec-small">({gameCount(group.games.length)})</span>
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
