import type { ReactNode } from 'react';
import {
  matchUrl,
  type OtherClubGames,
  type PlayerFixtures,
  type PlayerEligibility,
  type PlayerRound,
  type PlayerRoundStatus,
  type PossibleFixture,
  type SideRounds,
} from '@zmnatz/usa-club-rugby-data';

import { formatDate } from './dates.ts';
import { EligibilityStatusChip, WaiverChip } from './EligibilityStatusChip.tsx';
import { CAUTION_ADVICE, type ReportSource } from './reportModel.ts';

export { CAUTION_ADVICE, type ReportSource };

/** One labeled fact in a player's facts list. */
function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value ?? '—'}</dd>
    </>
  );
}

const ROUND_STATUS: Record<PlayerRoundStatus, string> = {
  started: 'Started',
  substitute: 'Came on as a substitute',
  unused: "Listed as a substitute, didn't come on",
  'not-listed': 'Not in the lineup',
  'no-lineup': 'No lineup recorded',
  forfeit: 'Forfeit, not counted',
  'forfeit-rostered': 'On the roster for a forfeit win',
  postponed: 'Postponed',
  'not-qualifying': 'Not an NCS Qualifying Match',
  'awaiting-result': 'No result yet',
  upcoming: 'Still to play',
};

const reportLink = (fixtureId: string, clubSlug: string | null) => (
  <a href={matchUrl(fixtureId, clubSlug)} target="_blank" rel="noopener noreferrer" style={{ whiteSpace: 'nowrap' }}>
    Rugby Xplorer
  </a>
);

/** One team's fixtures for one player, each linked to its Rugby Xplorer report. */
function TeamRounds({
  teamName,
  rounds,
  clubSlug,
}: {
  teamName: string;
  rounds: PlayerRound[];
  clubSlug: string | null;
}) {
  const counted = rounds.filter((round) => round.counted).length;
  return (
    <div className="ec-stack-sm">
      <h3 style={{ margin: 0, fontSize: '1rem' }}>
        {teamName}: {counted} counted {counted === 1 ? 'match' : 'matches'}
      </h3>
      <div className="ec-table-wrap ec-table-outlined">
        <table className="ec-table">
          <thead>
            <tr>
              <th>Round</th>
              <th>Date</th>
              <th>Opponent</th>
              <th>Score</th>
              <th>This player</th>
              <th className="ec-center">Counted</th>
              <th>Report</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((round) => (
              <tr key={round.fixtureId}>
                <td>{round.round}</td>
                <td>{formatDate(round.dateTime)}</td>
                <td>{round.opponent || 'To be decided'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {round.scoreFor || round.scoreAgainst ? `${round.scoreFor} - ${round.scoreAgainst}` : '—'}
                </td>
                <td>
                  {ROUND_STATUS[round.status]}
                  {round.substitutionsMissing && (
                    <div className="ec-caption" style={{ color: 'var(--ec-warning)' }}>
                      No substitutions recorded for this match
                    </div>
                  )}
                </td>
                <td className="ec-center">{round.counted ? 'Yes' : 'No'}</td>
                <td>{reportLink(round.fixtureId, clubSlug)}</td>
              </tr>
            ))}
            {rounds.length === 0 && (
              <tr>
                <td colSpan={7} className="ec-center ec-muted">
                  No fixtures this season.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** A round table for each side the player has played for, own side first; every
 *  side feeds the verdict. A side they haven't played for gets only a line. */
function PlayedRounds({ sides, clubSlug }: { sides: SideRounds[]; clubSlug: string | null }) {
  const notPlayed = sides.filter(({ rounds }) => !rounds.some((round) => round.counted));
  return (
    <>
      {sides
        .filter(({ rounds }) => rounds.some((round) => round.counted))
        .map(({ teamName, rounds }) => (
          <TeamRounds key={teamName} teamName={teamName} rounds={rounds} clubSlug={clubSlug} />
        ))}
      {notPlayed.length > 0 && (
        <p className="ec-muted ec-small" style={{ margin: 0 }}>
          No matches played this season for {notPlayed.map(({ teamName }) => teamName).join(', ')}.
        </p>
      )}
    </>
  );
}

/** The fixtures behind an on-track verdict. */
function PossibleFixtures({ possible, clubSlug }: { possible: PossibleFixture[]; clubSlug: string | null }) {
  return (
    <div className="ec-stack-sm">
      <h3 style={{ margin: 0, fontSize: '1rem' }}>Possible fixtures: {possible.length} left</h3>
      <span className="ec-caption ec-muted">
        Why this player is on track. They could still reach the minimum in these fixtures, though
        availability isn&apos;t checked and a side may not reach a playoff. On track is experimental:
        future playoff matches aren&apos;t always entered in Rugby Xplorer, so this list may be incomplete.
      </span>
      <div className="ec-table-wrap ec-table-outlined">
        <table className="ec-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Side</th>
              <th>Opponent</th>
              <th>Competition</th>
              <th>Report</th>
            </tr>
          </thead>
          <tbody>
            {possible.map((fixture) => (
              <tr key={`${fixture.teamName}-${fixture.fixtureId ?? fixture.dateTime}`}>
                <td>{formatDate(fixture.dateTime)}</td>
                <td>{fixture.teamName}</td>
                <td>{fixture.open ? 'Playoff, teams not decided' : fixture.opponent || 'To be decided'}</td>
                <td>{fixture.competition}</td>
                <td>{fixture.fixtureId && reportLink(fixture.fixtureId, clubSlug)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export interface PlayerDetailProps {
  player: PlayerEligibility;
  source: ReportSource;
  ownLabel: string;
  /** The fixtures behind a club report's verdict; null for a CSV report's. */
  fixtures: PlayerFixtures | null;
  /** Tells this player apart from another with the same name. */
  showCmsId?: boolean;
  /** Rugby Xplorer's own club slug. Match links use the council's path without one. */
  clubSlug?: string | null;
  /** The player's games for other clubs that season, which aren't counted here. */
  otherClubs?: OtherClubGames[];
  footer?: ReactNode;
}

/** A moved player's games for their other clubs. */
function OtherClubRounds({ otherClubs, clubSlug }: { otherClubs: OtherClubGames[]; clubSlug: string | null }) {
  return (
    <>
      <p className="ec-muted ec-small" style={{ margin: 0 }}>
        Also played for {otherClubs.map((other) => other.clubName).join(', ')} this season. Those games are
        listed below and aren&apos;t counted for this club.
      </p>
      {otherClubs.flatMap((other) =>
        other.sides.map(({ teamName, rounds }) => (
          <TeamRounds key={`${other.clubKey}-${teamName}`} teamName={`${other.clubName} · ${teamName}`} rounds={rounds} clubSlug={clubSlug} />
        )),
      )}
    </>
  );
}

/** A player's name, ids and verdict chip: the page's heading. */
export function PlayerDetailHeading({
  player,
  source,
  showCmsId = false,
  otherClubs,
  component = 'span',
}: Pick<PlayerDetailProps, 'player' | 'source' | 'showCmsId' | 'otherClubs'> & { component?: 'span' | 'h1' }) {
  const Name = component;
  return (
    <div className="ec-row">
      <Name style={{ fontSize: component === 'h1' ? '2rem' : '1.25rem', fontWeight: 600, margin: 0 }}>{player.name}</Name>
      {source === 'csv' && <span className="ec-muted ec-small">USA ID {player.playerId}</span>}
      {source === 'record' && showCmsId && <span className="ec-muted ec-small">CMS ID {player.playerId}</span>}
      <EligibilityStatusChip player={player} />
      {otherClubs && otherClubs.length > 0 && <WaiverChip />}
    </div>
  );
}

/** Everything about one player's verdict, as shown on the player page. */
export function PlayerDetailBody({ player, source, ownLabel, fixtures, clubSlug = null, otherClubs, footer }: PlayerDetailProps) {
  return (
    <div className="ec-stack">
      {player.reasons.length > 0 && <p className="ec-muted ec-small" style={{ margin: 0 }}>{player.reasons.join(' · ')}</p>}
      {player.cautions.length > 0 && (
        <p className="ec-muted ec-small" style={{ margin: 0 }}>
          {player.cautions.join(' · ')}. {CAUTION_ADVICE}
        </p>
      )}
      {player.pending.length > 0 && <p className="ec-muted ec-small" style={{ margin: 0 }}>{player.pending.join(' · ')}</p>}
      <dl className="ec-facts">
        {source === 'csv' && <Fact label="Last registered" value={player.lastRegistered} />}
        <Fact label="Side" value={`${ownLabel} side`} />
        <Fact label="Played" value={player.played} />
        <Fact label="Substitute" value={player.substitute} />
        <Fact label="Participation" value={player.participation} />
        {player.otherSides.map((side) => (
          <Fact key={side.teamName} label={`${side.label} participation`} value={side.participation} />
        ))}
      </dl>
      {fixtures && fixtures.possible.length > 0 && <PossibleFixtures possible={fixtures.possible} clubSlug={clubSlug} />}
      {fixtures ? (
        <>
          <PlayedRounds sides={fixtures.sides} clubSlug={clubSlug} />
          {otherClubs && otherClubs.length > 0 && <OtherClubRounds otherClubs={otherClubs} clubSlug={clubSlug} />}
          <p className="ec-muted ec-small" style={{ margin: 0 }}>
            Open a report to check a line against Rugby Xplorer.
          </p>
        </>
      ) : (
        player.rows.map((row) => (
          <div key={row.competition || 'report row'}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>
              {row.competition || 'Report row'} — {row.teamName}
            </h3>
            <span className="ec-caption ec-muted">
              Appearances {row.appearances} · Played {row.played} · Substitute {row.substitute}
            </span>
          </div>
        ))
      )}
      {footer}
    </div>
  );
}
