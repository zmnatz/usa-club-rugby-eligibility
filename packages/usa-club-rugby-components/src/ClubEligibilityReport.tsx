import { useMemo, useState } from 'react';
import { Alert, Button, Link as MuiLink, Toolbar, Typography } from '@mui/material';
import {
  type ClubRecord,
  clubGaps,
  computeBreakdown,
  DEFAULT_RULES,
  type FeedFixture,
  fetchMatchCentre,
  loadClubRecord,
  type ParticipationSnapshot,
  participationRows,
  type PlayerRecordInput,
  type PublishedClub,
  remainingMatches,
} from '@zmnatz/usa-club-rugby-data';
import { formatDateTime } from './dates.ts';
import { EligibilityReportView } from './EligibilityReportView.tsx';
import { useEligibilityLinks } from './links.tsx';

/** A visitor's check for matches newer than the saved Match Record. */
interface RecordCheck {
  clubName: string;
  checking: boolean;
  /** The latest result; null before one lands, or if the check failed. */
  record: ClubRecord | null;
}

export interface ClubEligibilityReportProps {
  club: PublishedClub;
  /** The club's saved Match Record, shown straight away. */
  saved: ParticipationSnapshot;
  /** The fixtures in the club's divisions, including those still to play. */
  fixtures: FeedFixture[];
  /** Offer visitors a button that checks the CMS for newer matches. Off by default. */
  live?: boolean;
  /** Rugby Xplorer's own club slug. Match links use the council's path without one. */
  clubSlug?: string | null;
}

/** One club's eligibility report from its Match Record: the saved data, replaced
 *  by a live pull when a visitor asks for one and it lands. */
export function ClubEligibilityReport({ club, saved, fixtures, live = false, clubSlug = null }: ClubEligibilityReportProps) {
  const { Link, routes } = useEligibilityLinks();
  const [activeSide, setActiveSide] = useState(0);
  const [check, setCheck] = useState<RecordCheck | null>(null);

  // A check made on the club shown before this one doesn't count.
  const shownCheck = check?.clubName === club.name ? check : null;
  const clubRecord = shownCheck?.record ?? null;
  const checking = shownCheck?.checking ?? false;
  const checkFailed = shownCheck !== null && !checking && clubRecord === null;
  const nothingNewer = !checking && clubRecord?.source === 'saved' && !clubRecord.liveFailed;

  const handleCheck = async () => {
    const clubName = club.name;
    const finish = (record: ClubRecord | null) =>
      setCheck((current) => (current?.clubName === clubName ? { clubName, checking: false, record } : current));
    setCheck({ clubName, checking: true, record: clubRecord });
    try {
      finish(await loadClubRecord(club, { live: true, fixtures, fetchMatch: fetchMatchCentre, loadSaved: async () => saved }));
    } catch {
      finish(null);
    }
  };

  const snapshot = clubRecord?.snapshot ?? saved;

  const breakdown = useMemo(
    () =>
      computeBreakdown(
        participationRows(snapshot, club, DEFAULT_RULES),
        club.sides,
        DEFAULT_RULES,
        remainingMatches(fixtures, club, DEFAULT_RULES),
      ),
    [club, snapshot, fixtures],
  );
  const gaps = useMemo(() => clubGaps(snapshot, club, DEFAULT_RULES), [snapshot, club]);
  const playerRecord: PlayerRecordInput = { club, snapshot, fixtures };

  const shownSource = clubRecord?.source ?? 'saved';
  const shownAsOf = clubRecord?.asOf ?? saved.generatedAt;

  return (
    <>
      <Typography color="textSecondary" gutterBottom>
        {`Counted from the lineups and substitutions entered in Rugby Xplorer for every
             senior club league and local playoff match. Fixtures still to play before Super
             Regionals count towards the two-match minimums, shown as on track (experimental).
             A player one upper-side match from losing a side for the season is shown as caution
             (experimental). Click a player to check their count round by round against the Rugby Xplorer match
             reports. This is a guide: the Rugby Xplorer Match Participation Report is the
             official count, and registration isn't checked.`}{' '}
        <MuiLink component={Link} href={routes.methodology()}>
          How this report is worked out
        </MuiLink>
      </Typography>

      <Toolbar variant="spread">
        <div>
          {shownAsOf && (
            <Typography variant="subtitle1" component="p">
              Records last updated {formatDateTime(shownAsOf)}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {snapshot.season} season · {shownSource === 'live' ? 'Live data' : 'Nightly data'}
            {checking && ' · checking for newer matches…'}
            {nothingNewer && ' · no newer matches'}
          </Typography>
        </div>
        {live && (
          <Button variant="outlined" size="small" onClick={handleCheck} disabled={checking}>
            Check for newer matches
          </Button>
        )}
      </Toolbar>

      {checkFailed && (
        <Alert severity="warning">
          Couldn&apos;t check for matches since the nightly data, so this shows the nightly data.
        </Alert>
      )}

      {clubRecord?.liveFailed && (
        <Alert severity="warning">
          The live pull failed, so this report uses saved data and may miss recent matches.
        </Alert>
      )}

      <EligibilityReportView
        source="record"
        club={club}
        breakdown={breakdown}
        gaps={gaps}
        record={playerRecord}
        season={snapshot.season}
        playerPages
        clubSlug={clubSlug}
        activeSide={activeSide}
        onActiveSideChange={setActiveSide}
      />
    </>
  );
}
