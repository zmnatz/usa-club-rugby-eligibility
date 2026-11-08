import NextLink from 'next/link';
import { Breadcrumbs, Link as MuiLink, Typography } from '@mui/material';
import { EligibilityStatusChip } from '@/components/EligibilityStatusChip';
import { PlayerDetailBody } from '@/components/PlayerEligibilityDialog';
import { Panel, Row, Section } from '@/theme';
import { clubPath } from '@/utils/paths';
import type { PlayerClubEntry, PlayerProfile } from '@zmnatz/usa-club-rugby-data';

/** A player's verdict in one club. */
function PlayerInClub({ entry }: { entry: PlayerClubEntry }) {
  return (
    <Section>
      <Row below={1}>
        <Typography variant="h5" component="h2">
          <MuiLink component={NextLink} href={clubPath(entry.clubKey)} underline="hover">
            {entry.clubName}
          </MuiLink>
          {entry.sideLabel && ` · ${entry.sideLabel}`}
        </Typography>
        <EligibilityStatusChip player={entry.player} />
        {entry.showCmsId && (
          <Typography variant="body2" color="text.secondary">
            CMS ID {entry.player.playerId}
          </Typography>
        )}
      </Row>
      <Panel>
        <PlayerDetailBody
          player={entry.player}
          source="record"
          ownLabel={entry.sideLabel}
          fixtures={entry.fixtures}
        />
      </Panel>
    </Section>
  );
}

/** One player's verdict and the matches behind it, on a page of its own so it can
 *  be linked to. A player can have played for several clubs, so there is a section
 *  for each: eligibility is worked out within a club. Built from the nightly data. */
export function PlayerPage({ data }: { data: PlayerProfile }) {
  return (
    <>
      <Breadcrumbs aria-label="breadcrumb">
        <MuiLink component={NextLink} href="/" underline="hover" color="inherit">
          All clubs
        </MuiLink>
        <Typography color="text.primary">{data.name}</Typography>
      </Breadcrumbs>
      <Typography variant="h4" component="h1" gutterBottom>
        {data.name}
      </Typography>
      {data.clubs.length > 1 && (
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Listed {data.clubs.length} times in the record, for different clubs or sides. Each is assessed on its own.
        </Typography>
      )}
      {data.clubs.map((entry) => (
        <PlayerInClub key={`${entry.clubKey}-${entry.player.teamName}`} entry={entry} />
      ))}
    </>
  );
}
