import { useMemo, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Link as MuiLink,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  matchUrl,
  type OtherClubGames,
  playerFixtures,
  type PlayerFixtures,
  type PlayerRecordInput,
  type SideRounds,
  type PlayerEligibility,
  type PlayerRound,
  type PlayerRoundStatus,
  type PlayerRow,
  type PossibleFixture,
} from '@zmnatz/usa-club-rugby-data';

import { formatDate } from './dates.ts';
import { EligibilityStatusChip, WaiverChip } from './EligibilityStatusChip.tsx';
import { wrapRow } from './layout.ts';
import { useEligibilityLinks } from './links.tsx';

import { CAUTION_ADVICE, type ReportSource } from './reportModel.ts';

export { CAUTION_ADVICE, type ReportSource };

/** One labeled fact row in the player detail dialog. */
function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" component="strong" align="right">
        {value ?? '—'}
      </Typography>
    </Stack>
  );
}

/** The per-round attendance codes across a player's competitions, as a matrix
 *  with one row per competition and one Round column per reported round. */
function RoundsMatrix({ rows }: { rows: PlayerRow[] }) {
  const roundNames = useMemo(() => {
    const names = new Set<string>();
    for (const source of rows) {
      for (const name of Object.keys(source.rounds)) names.add(name);
    }
    return [...names].sort((a, b) => {
      const numOf = (name: string) => Number(name.match(/\d+/)?.[0]);
      const na = numOf(a);
      const nb = numOf(b);
      if (Number.isNaN(na) && Number.isNaN(nb)) return a.localeCompare(b);
      if (Number.isNaN(na)) return 1;
      if (Number.isNaN(nb)) return -1;
      return na - nb;
    });
  }, [rows]);

  if (roundNames.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No round data.
      </Typography>
    );
  }
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Competition</TableCell>
            {roundNames.map((round) => (
              <TableCell key={round} align="center">
                {round}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((source) => (
            <TableRow key={source.competition || 'report row'}>
              <TableCell>{source.competition || 'Report row'}</TableCell>
              {roundNames.map((round) => {
                const code = source.rounds[round];
                const shown = code && code !== 'R' ? code : null;
                return (
                  <TableCell key={round} align="center">
                    {shown ?? (
                      <Typography variant="inherit" component="span" color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
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

function roundDate(dateTime: string): string {
  return formatDate(dateTime);
}

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
    <Stack spacing={1} useFlexGap>
      <Typography variant="subtitle2" component="h3">
        {teamName}: {counted} counted {counted === 1 ? 'match' : 'matches'}
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Round</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Opponent</TableCell>
              <TableCell>Score</TableCell>
              <TableCell>This player</TableCell>
              <TableCell align="center">Counted</TableCell>
              <TableCell>Report</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rounds.map((round) => (
              <TableRow key={round.fixtureId}>
                <TableCell>{round.round}</TableCell>
                <TableCell>{roundDate(round.dateTime)}</TableCell>
                <TableCell>{round.opponent || 'To be decided'}</TableCell>
                <TableCell>
                  <Typography variant="inherit" component="span" noWrap>
                    {round.scoreFor || round.scoreAgainst ? `${round.scoreFor} - ${round.scoreAgainst}` : '—'}
                  </Typography>
                </TableCell>
                <TableCell>
                  {ROUND_STATUS[round.status]}
                  {round.substitutionsMissing && (
                    <Typography variant="caption" color="warning.main" component="div">
                      No substitutions recorded for this match
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="center">{round.counted ? 'Yes' : 'No'}</TableCell>
                <TableCell>
                  <MuiLink noWrap href={matchUrl(round.fixtureId, clubSlug)} target="_blank" rel="noopener noreferrer">
                    Rugby Xplorer
                  </MuiLink>
                </TableCell>
              </TableRow>
            ))}
            {rounds.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" component="span" color="text.secondary">
                    No fixtures this season.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
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
        <Typography variant="body2" color="textSecondary">
          No matches played this season for {notPlayed.map(({ teamName }) => teamName).join(', ')}.
        </Typography>
      )}
    </>
  );
}

/** The fixtures behind an on-track verdict. */
function PossibleFixtures({ possible, clubSlug }: { possible: PossibleFixture[]; clubSlug: string | null }) {
  return (
    <Stack spacing={1} useFlexGap>
      <Typography variant="subtitle2" component="h3">Possible fixtures: {possible.length} left</Typography>
      <Typography variant="caption" color="text.secondary">
        Why this player is on track. They could still reach the minimum in these fixtures, though
        availability isn&apos;t checked and a side may not reach a playoff. On track is experimental:
        future playoff matches aren&apos;t always entered in Rugby Xplorer, so this list may be incomplete.
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Side</TableCell>
              <TableCell>Opponent</TableCell>
              <TableCell>Competition</TableCell>
              <TableCell>Report</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {possible.map((fixture) => (
              <TableRow key={`${fixture.teamName}-${fixture.fixtureId ?? fixture.dateTime}`}>
                <TableCell>{roundDate(fixture.dateTime)}</TableCell>
                <TableCell>{fixture.teamName}</TableCell>
                <TableCell>{fixture.open ? 'Playoff, teams not decided' : fixture.opponent || 'To be decided'}</TableCell>
                <TableCell>{fixture.competition}</TableCell>
                <TableCell>
                  {fixture.fixtureId && (
                    <MuiLink noWrap href={matchUrl(fixture.fixtureId, clubSlug)} target="_blank" rel="noopener noreferrer">
                      Rugby Xplorer
                    </MuiLink>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
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
      <Typography variant="body2" color="textSecondary">
        Also played for {otherClubs.map((other) => other.clubName).join(', ')} this season. Those games are
        listed below and aren&apos;t counted for this club.
      </Typography>
      {otherClubs.flatMap((other) =>
        other.sides.map(({ teamName, rounds }) => (
          <TeamRounds key={`${other.clubKey}-${teamName}`} teamName={`${other.clubName} · ${teamName}`} rounds={rounds} clubSlug={clubSlug} />
        )),
      )}
    </>
  );
}

/** A player's name, ids and verdict chip: the dialog's title and the page's heading. */
export function PlayerDetailHeading({
  player,
  source,
  showCmsId = false,
  otherClubs,
  component = 'span',
}: Pick<PlayerDetailProps, 'player' | 'source' | 'showCmsId' | 'otherClubs'> & { component?: 'span' | 'h1' }) {
  return (
    <Stack direction="row" spacing={1} useFlexGap sx={wrapRow}>
      <Typography variant={component === 'h1' ? 'h4' : 'h6'} component={component}>
        {player.name}
      </Typography>
      {source === 'csv' && (
        <Typography variant="body2" color="text.secondary" component="span">
          USA ID {player.playerId}
        </Typography>
      )}
      {source === 'record' && showCmsId && (
        <Typography variant="body2" color="text.secondary" component="span">
          CMS ID {player.playerId}
        </Typography>
      )}
      <EligibilityStatusChip player={player} />
      {otherClubs && otherClubs.length > 0 && <WaiverChip />}
    </Stack>
  );
}

/** Everything about one player's verdict, shared by the dialog and the player page. */
export function PlayerDetailBody({ player, source, ownLabel, fixtures, clubSlug = null, otherClubs, footer }: PlayerDetailProps) {
  return (
    <Stack spacing={2} useFlexGap>
      {player.reasons.length > 0 && (
        <Typography variant="body2" color="textSecondary">
          {player.reasons.join(' · ')}
        </Typography>
      )}
      {player.cautions.length > 0 && (
        <Typography variant="body2" color="textSecondary">
          {player.cautions.join(' · ')}. {CAUTION_ADVICE}
        </Typography>
      )}
      {player.pending.length > 0 && (
        <Typography variant="body2" color="textSecondary">
          {player.pending.join(' · ')}
        </Typography>
      )}
      <div>
        {source === 'csv' && <Fact label="Last registered" value={player.lastRegistered} />}
        <Fact label="Side" value={`${ownLabel} side`} />
        <Fact label="Played" value={player.played} />
        <Fact label="Substitute" value={player.substitute} />
        <Fact label="Participation" value={player.participation} />
        {player.otherSides.map((side) => (
          <Fact key={side.teamName} label={`${side.label} participation`} value={side.participation} />
        ))}
      </div>
      {fixtures && fixtures.possible.length > 0 && <PossibleFixtures possible={fixtures.possible} clubSlug={clubSlug} />}
      {fixtures ? (
        <>
          <PlayedRounds sides={fixtures.sides} clubSlug={clubSlug} />
          {otherClubs && otherClubs.length > 0 && <OtherClubRounds otherClubs={otherClubs} clubSlug={clubSlug} />}
          <Typography variant="body2" color="textSecondary">
            Open a report to check a line against Rugby Xplorer.
          </Typography>
        </>
      ) : (
        <>
          {player.rows.map((row) => (
            <div key={row.competition || 'report row'}>
              <Typography variant="subtitle2" component="h3">
                {row.competition || 'Report row'} — {row.teamName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Appearances {row.appearances} · Played {row.played} · Substitute {row.substitute}
              </Typography>
            </div>
          ))}
          <Stack spacing={1} useFlexGap>
            <Typography variant="subtitle2" component="h3">Rounds by competition</Typography>
            <RoundsMatrix rows={player.rows} />
          </Stack>
        </>
      )}
      {footer}
    </Stack>
  );
}

/** Full report detail for one player, opened by clicking a table row. A club
 *  report's players also have a page of their own, linked from here. */
export function PlayerEligibilityDialog({
  player,
  record,
  pageHref,
  onClose,
  ...detail
}: Omit<PlayerDetailProps, 'player' | 'fixtures'> & {
  player: PlayerEligibility | null;
  /** What the fixtures are worked out from; absent for a CSV report. */
  record: PlayerRecordInput | null;
  /** The player's own page, when they have one. */
  pageHref?: string;
  onClose: () => void;
}) {
  const { Link } = useEligibilityLinks();
  return (
    <Dialog open={player !== null} onClose={onClose} maxWidth="md" fullWidth>
      {player !== null && (
        <>
          <DialogTitle>
            <PlayerDetailHeading player={player} source={detail.source} showCmsId={detail.showCmsId} otherClubs={detail.otherClubs} />
            {pageHref && (
              <Typography variant="body2">
                <MuiLink component={Link} href={pageHref}>
                  Open as a page
                </MuiLink>
              </Typography>
            )}
          </DialogTitle>
          <DialogContent dividers>
            <PlayerDetailBody
              player={player}
              fixtures={record ? playerFixtures(player, record) : null}
              {...detail}
            />
          </DialogContent>
        </>
      )}
    </Dialog>
  );
}
