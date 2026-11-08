import { useMemo, useState } from 'react';
import { Link as MuiLink, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import {
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
import { ReportAlert, Row } from './primitives.tsx';

const LIVE_RECORD_STALE_MS = 10 * 60 * 1000;

export interface ClubEligibilityReportProps {
  club: PublishedClub;
  /** The club's saved Match Record, shown straight away. */
  saved: ParticipationSnapshot;
  /** The fixtures in the club's divisions, including those still to play. */
  fixtures: FeedFixture[];
  /** Top the saved Match Record up from the CMS. Off by default. */
  live?: boolean;
  /** Rugby Xplorer's own club slug. Match links use the council's path without one. */
  clubSlug?: string | null;
}

/** One club's eligibility report from its Match Record: saved data first, replaced
 *  by a live pull when the host asks for one and it lands. */
export function ClubEligibilityReport({ club, saved, fixtures, live = false, clubSlug = null }: ClubEligibilityReportProps) {
  const { Link, routes } = useEligibilityLinks();
  const [activeSide, setActiveSide] = useState(0);
  const record = useQuery({
    queryKey: ['eligibility-record', club.name],
    queryFn: () =>
      loadClubRecord(club, { live, fixtures, fetchMatch: fetchMatchCentre, loadSaved: async () => saved }),
    staleTime: LIVE_RECORD_STALE_MS,
    retry: false,
  });
  const clubRecord = record.data ?? null;
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

      <Row gap={2} below={3}>
        <Typography variant="body2" color="text.secondary">
          {snapshot.season} season · {shownSource === 'live' ? 'Live data' : 'Nightly data'}
          {shownAsOf && ` ${shownSource === 'live' ? 'from' : 'last changed'} ${formatDateTime(shownAsOf)}`}
          {record.isFetching && ' · checking for newer matches…'}
        </Typography>
      </Row>

      {record.isError && (
        <ReportAlert severity="warning">
          Couldn&apos;t check for matches since the nightly data, so this shows the nightly data.
        </ReportAlert>
      )}

      {clubRecord?.liveFailed && (
        <ReportAlert severity="warning">
          The live pull failed, so this report uses saved data and may miss recent matches.
        </ReportAlert>
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
