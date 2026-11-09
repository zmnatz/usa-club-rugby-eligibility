import { useMemo, useState } from 'react';
import { Alert, Link as MuiLink, Stack, Typography } from '@mui/material';
import {
  clubBreakdown,
  clubGaps,
  type FeedFixture,
  type ParticipationSnapshot,
  type PlayerRecordInput,
  type PublishedClub,
  rulesForSeason,
} from '@zmnatz/usa-club-rugby-data';
import { formatDateTime } from './dates.ts';
import { EligibilityReportView } from './EligibilityReportView.tsx';
import { useEligibilityLinks } from './links.tsx';

export interface ClubEligibilityReportProps {
  club: PublishedClub;
  /** The club's saved Match Record. */
  saved: ParticipationSnapshot;
  /** The fixtures in the club's divisions, including those still to play. */
  fixtures: FeedFixture[];
  /** Rugby Xplorer's own club slug. Match links use the council's path without one. */
  clubSlug?: string | null;
}

/** One club's eligibility report from its saved Match Record. */
export function ClubEligibilityReport({ club, saved, fixtures, clubSlug = null }: ClubEligibilityReportProps) {
  const { Link, routes } = useEligibilityLinks();
  const [activeSide, setActiveSide] = useState(0);

  const locked = saved.locked === true;
  const breakdown = useMemo(() => clubBreakdown(saved, fixtures, club), [club, saved, fixtures]);
  const gaps = useMemo(() => clubGaps(saved, club, rulesForSeason(saved.season)), [saved, club]);
  const playerRecord: PlayerRecordInput = { club, snapshot: saved, fixtures };

  return (
    <>
      <Typography color="textSecondary" gutterBottom>
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
             (experimental). Click a player to check their count round by round against the Rugby Xplorer match
             reports. This is a guide: the Rugby Xplorer Match Participation Report is the
             official count, and registration isn't checked.`}{' '}
        <MuiLink component={Link} href={routes.methodology()}>
          How this report is worked out
        </MuiLink>
      </Typography>

      <Stack spacing={2} useFlexGap>
        <div>
          {saved.generatedAt && (
            <Typography variant="subtitle1" component="p">
              Records last updated {formatDateTime(saved.generatedAt)}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {saved.season} season · {locked ? 'Locked Season' : 'Nightly data'}
          </Typography>
        </div>

        {club.unplacedTeams && (
          <Alert severity="warning">
            The record doesn&apos;t say which division these teams played in, so their matches aren&apos;t
            counted and players at lower divisions may be wrongly shown as eligible:{' '}
            {club.unplacedTeams.join(', ')}.
          </Alert>
        )}

        <EligibilityReportView
          source="record"
          club={club}
          breakdown={breakdown}
          gaps={gaps}
          record={playerRecord}
          season={saved.season}
          playerPages={!locked}
          locked={locked}
          clubSlug={clubSlug}
          activeSide={activeSide}
          onActiveSideChange={setActiveSide}
        />
      </Stack>
    </>
  );
}
