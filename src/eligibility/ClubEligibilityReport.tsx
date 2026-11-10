import { useMemo, useState } from 'react';
import {
  clubSeason,
  mergedClubNotes,
  type FeedFixture,
  type ParticipationSnapshot,
  type PublishedClub,
} from '@zmnatz/usa-club-rugby-data';
import { formatDateTime } from './dates';
import { EligibilityReportView } from './EligibilityReportView';
import { PlayerDialog } from './PlayerDialog';
import { ReportProblemNote } from './ReportProblemNote';
import { SeasonRules } from './SeasonRules';
import { useEligibilityLinks } from './links';

export interface ClubEligibilityReportProps {
  club: PublishedClub;
  /** The club's saved Match Record. */
  saved: ParticipationSnapshot;
  /** The fixtures in the club's divisions, including those still to play. */
  fixtures: FeedFixture[];
}

/** One club's eligibility report from its saved Match Record. */
export function ClubEligibilityReport({ club, saved, fixtures }: ClubEligibilityReportProps) {
  const { Link, routes } = useEligibilityLinks();

  const locked = saved.locked === true;
  // A Locked Season's notes come with its file; this season's are worked out here.
  const notes = locked ? club.notes : mergedClubNotes(club);
  const { breakdown, gaps } = useMemo(() => clubSeason(saved, fixtures, club), [club, saved, fixtures]);
  // A Locked Season's players have no page of their own: their detail opens in a dialog.
  const [selected, setSelected] = useState<{ playerId: string; teamName: string } | null>(null);

  return (
    <>
      <p className="ec-muted" style={{ maxWidth: 840 }}>
        {locked
          ? `Counted from the lineups and substitutions entered in Rugby Xplorer for every
             senior club league and local playoff match, under the regulations of the
             ${saved.season} season. The season is over, so each verdict is final: a player was
             eligible or not. This is a guide: the Rugby Xplorer Match Participation Report is
             the official count, and registration isn't checked.`
          : `Counted from the lineups and substitutions entered in Rugby Xplorer for every
             senior club league and local playoff match. Fixtures still to play before Super
             Regionals count towards the two-match minimums, shown as on track (experimental).
             A player one upper-side match from losing a side for the season is shown as caution
             (experimental). Open a player's page to check their count round by round against the
             Rugby Xplorer match reports. This is a guide: the Rugby Xplorer Match Participation
             Report is the official count, and registration isn't checked.`}{' '}
        <Link href={routes.methodology()}>How this report is worked out</Link>
      </p>
      <ReportProblemNote season={saved.season} club={{ key: club.key, name: club.name }} locked={locked} />

      <div className="ec-stack">
        <div>
          {saved.generatedAt && <p style={{ margin: 0 }}>Records last updated {formatDateTime(saved.generatedAt)}</p>}
          <span className="ec-muted ec-small">
            {saved.season} season · {locked ? 'Locked Season' : 'Nightly data'}
          </span>
        </div>

        {locked && <SeasonRules season={saved.season} />}

        {notes && notes.length > 0 && (
          <div className="ec-alert ec-alert--info">
            <p>How this club&apos;s teams were read from the record:</p>
            <ul>
              {notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {club.unplacedTeams && (
          <div className="ec-alert ec-alert--warning">
            The record doesn&apos;t say which division these teams played in, so their matches aren&apos;t
            counted and players at lower divisions may be wrongly shown as eligible:{' '}
            {club.unplacedTeams.join(', ')}.
          </div>
        )}

        <EligibilityReportView
          source="record"
          club={club}
          breakdown={breakdown}
          gaps={gaps}
          season={saved.season}
          recordsUpdated={saved.generatedAt || undefined}
          playerPages={!locked}
          onPlayerSelect={locked ? (playerId, teamName) => setSelected({ playerId, teamName }) : undefined}
          locked={locked}
          transfers={saved.transfers}
        />
      </div>
      {selected && (
        <PlayerDialog
          club={club}
          saved={saved}
          fixtures={fixtures}
          breakdown={breakdown}
          selected={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
