import {
  formatDate,
  matchUrl,
  type UnreportedGame,
  type UnreportedReason,
  type UnreportedSide,
} from '@zmnatz/usa-club-rugby-data';
import { useState } from 'react';
import { useEligibilityLinks } from './links.tsx';

export interface UnreportedGamesProps {
  games: UnreportedGame[];
}

/** The divisions the filter offers, in order. The stylesheet has a rule for each. */
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

function reasonText(reason: UnreportedReason): string {
  if (reason.kind === 'no-result') return 'No result entered';
  const label = REASONS.find(([kind]) => kind === reason.kind)?.[1];
  return `${label}: ${reason.teamName}`;
}

interface FilterProps {
  name: string;
  legend: string;
  options: [string, string][];
  onChange: (value: string) => void;
}

function Filter({ name, legend, options, onChange }: FilterProps) {
  return (
    <fieldset className="ec-segmented" onChange={(event) => {
        if (event.target instanceof HTMLInputElement) onChange(event.target.value);
      }}>
      <legend className="ec-sr">{legend}</legend>
      {[['all', 'All'], ...options].map(([value, label]) => (
        <label key={value}>
          <input type="radio" name={name} value={value} defaultChecked={value === 'all'} />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

function Side({ side }: { side: UnreportedSide }) {
  const { Link, routes } = useEligibilityLinks();
  return (
    <>
      {side.clubKey ? <Link href={routes.club(side.clubKey)}>{side.clubName}</Link> : side.clubName}
      <div className="ec-muted ec-small">{side.teamName}</div>
    </>
  );
}

const gameCount = (count: number) => (count === 1 ? '1 game' : `${count} games`);

/** Current-season games whose record still needs entering, filterable by division and
 *  reason. The stylesheet hides the rows a filter leaves out, so filtering needs no
 *  JavaScript; React only keeps the count in step. */
export function UnreportedGames({ games }: UnreportedGamesProps) {
  const [division, setDivision] = useState('all');
  const [reason, setReason] = useState('all');
  const shown = games.filter(
    (game) =>
      (division === 'all' || game.divisions.includes(division)) &&
      (reason === 'all' || game.reasons.some((entry) => entry.kind === reason)),
  ).length;
  const divisions = DIVISIONS.filter(([code]) => games.some((game) => game.divisions.includes(code)));
  const reasons = REASONS.filter(([kind]) => games.some((game) => game.reasons.some((reason) => reason.kind === kind)));

  if (games.length === 0) {
    return (
      <section className="ec-card">
        <p className="ec-muted">No games are overdue.</p>
      </section>
    );
  }

  return (
    <section className="ec-card ec-unreported" aria-labelledby="unreported-title">
      <div className="ec-toolbar">
        <h2 id="unreported-title" aria-live="polite">
          {shown === games.length ? gameCount(games.length) : `${shown} of ${gameCount(games.length)}`}
        </h2>
        <div className="ec-controls">
          <Filter name="unreported-division" legend="Division" options={divisions} onChange={setDivision} />
          <Filter name="unreported-reason" legend="Reason" options={reasons} onChange={setReason} />
        </div>
      </div>
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
            {games.map((game) => (
              <tr
                key={game.fixtureId}
                data-divisions={game.divisions.join(' ')}
                data-reasons={[...new Set(game.reasons.map((reason) => reason.kind))].join(' ')}
              >
                <td>
                  <a href={matchUrl(game.fixtureId)} target="_blank" rel="noopener noreferrer">
                    {formatDate(game.dateTime)}
                  </a>
                  <div className="ec-muted ec-small">
                    {game.daysOverdue === 1 ? '1 day overdue' : `${game.daysOverdue} days overdue`}
                  </div>
                </td>
                <td>
                  <Side side={game.home} />
                </td>
                <td>
                  <Side side={game.away} />
                </td>
                <td>
                  {game.divisions.map(divisionLabel).join(' / ') || '—'}
                  <div className="ec-muted ec-small">{game.competition}</div>
                </td>
                <td>
                  <ul className="ec-reasons">
                    {game.reasons.map((reason) => (
                      <li key={reasonText(reason)}>{reasonText(reason)}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
