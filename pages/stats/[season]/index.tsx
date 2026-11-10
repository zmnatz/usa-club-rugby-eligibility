import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import NextLink from 'next/link';
import {
  Breadcrumbs,
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
import { SeasonRules } from '@zmnatz/usa-club-rugby-components';
import { type SeasonSummary, seasonSummary } from '@zmnatz/usa-club-rugby-data';
import { HISTORY_RELOAD_SCRIPT } from '@/utils/historyReload';
import { seasonPath, statsPath } from '@/utils/paths';
import { readSeasonFile, readSeasons } from '@/utils/published';

// One page per Locked Season, worked out at build time from its file, so it opens at
// once, can be linked to and needs no JavaScript. There are only a few seasons, so
// they cost the build little, unlike a page per club.
export const config = { unstable_runtimeJS: false };

interface StatsProps {
  season: string;
  slug: string;
  summary: SeasonSummary;
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: readSeasons().map(({ slug }) => ({ params: { season: slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<StatsProps> = async ({ params }) => {
  if (typeof params?.season !== 'string') return { notFound: true };
  const file = readSeasonFile(params.season);
  return { props: { season: file.season, slug: file.slug, summary: seasonSummary(file) } };
};

const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
const percent = (part: number, whole: number) => (whole === 0 ? '—' : `${Math.round((100 * part) / whole)}%`);

/** The season's verdicts counted across every club. */
function SeasonStatsBody({ summary }: { summary: SeasonSummary }) {
  const { ineligible, gaps } = summary;
  return (
    <Stack spacing={1.5} useFlexGap>
        <Typography variant="body2">
          {count(summary.players, 'player')} played {count(summary.matches, 'counted match', 'counted matches')} for{' '}
          {count(summary.clubs, 'club')}, {summary.multiSideClubs.toLocaleString('en-US')} of them with more than one side (
          {count(summary.sides, 'side')} in all), with {count(summary.transfers, 'transfer')} between clubs.
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Eligibility by division">
            <TableHead>
              <TableRow>
                <TableCell>Division</TableCell>
                <TableCell align="right">Sides</TableCell>
                <TableCell align="right">Players</TableCell>
                <TableCell align="right">Eligible</TableCell>
                <TableCell align="right">Share</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.divisions.map((row) => (
                <TableRow key={row.division}>
                  <TableCell>{row.division}</TableCell>
                  <TableCell align="right">{row.sides.toLocaleString('en-US')}</TableCell>
                  <TableCell align="right">{row.players.toLocaleString('en-US')}</TableCell>
                  <TableCell align="right">{row.eligible.toLocaleString('en-US')}</TableCell>
                  <TableCell align="right">{percent(row.eligible, row.players)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant="caption" color="text.secondary">
          Players are counted for each side they played for, so a player at a club with several sides can appear in more
          than one division.
        </Typography>
        {ineligible.verdicts > 0 && (
          <Typography variant="body2">
            Of the {count(ineligible.verdicts, 'time', 'times')} a player wasn&apos;t eligible for a side they played for,{' '}
            {ineligible.shortOfMinimum.toLocaleString('en-US')} were short of the minimum,{' '}
            {ineligible.upperSideLimit.toLocaleString('en-US')} reached the upper-side limit and{' '}
            {ineligible.upperSideShare.toLocaleString('en-US')} had too many matches for the sides above. Some had more than
            one reason.
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          Gaps in the record: {count(gaps.noLineup, 'result')} with no lineup and {count(gaps.noSubstitutions, 'result')} with
          no substitutions entered. Players in those matches may be undercounted.
        </Typography>
    </Stack>
  );
}

export default function SeasonStatsPage({ season, slug, summary }: StatsProps) {
  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed string, with no data in it */}
      <script dangerouslySetInnerHTML={{ __html: HISTORY_RELOAD_SCRIPT }} />
      <Head>
        <title>{`${season} season stats · USA Club Rugby Eligibility`}</title>
        <meta
          name="description"
          content={`NCS eligibility across every USA Club Rugby senior club in the ${season} season, from the Rugby Xplorer match record.`}
        />
      </Head>
      <Breadcrumbs aria-label="breadcrumb">
        <MuiLink component={NextLink} prefetch={false} href="/" underline="hover" color="inherit">
          All clubs
        </MuiLink>
        <MuiLink component={NextLink} prefetch={false} href={statsPath('')} underline="hover" color="inherit">
          Past season stats
        </MuiLink>
        <Typography color="text.primary">{season}</Typography>
      </Breadcrumbs>
      <Typography variant="h4" component="h1" gutterBottom>
        {season} season stats
      </Typography>
      <Stack spacing={3} useFlexGap>
        <SeasonStatsBody summary={summary} />
        <SeasonRules season={season} />
        <Typography variant="body2">
          <MuiLink component={NextLink} prefetch={false} href={seasonPath(slug)}>
            See each club&apos;s verdicts for {season}
          </MuiLink>
        </Typography>
      </Stack>
    </>
  );
}
