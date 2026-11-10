import type { GetStaticProps } from 'next';
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
import { type SeasonSummary, seasonSummary } from '@zmnatz/usa-club-rugby-data';
import { HISTORY_RELOAD_SCRIPT } from '@/utils/historyReload';
import { statsPath } from '@/utils/paths';
import { readSeasonFile, readSeasons } from '@/utils/published';

// Every Locked Season's stats side by side, worked out at build time like each
// season's own stats page.
export const config = { unstable_runtimeJS: false };

interface SeasonStats {
  season: string;
  slug: string;
  summary: SeasonSummary;
}

export const getStaticProps: GetStaticProps<{ seasons: SeasonStats[] }> = async () => ({
  props: {
    seasons: readSeasons().map(({ slug }) => {
      const file = readSeasonFile(slug);
      return { season: file.season, slug, summary: seasonSummary(file) };
    }),
  },
});

const n = (value: number) => value.toLocaleString('en-US');
const percent = (part: number, whole: number) => (whole === 0 ? '—' : `${Math.round((100 * part) / whole)}%`);
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** A table with a row per measure, a column per season and one for every season. */
function BySeason({
  label,
  seasons,
  rows,
}: {
  label: string;
  seasons: SeasonStats[];
  rows: { name: string; values: string[]; total: string }[];
}) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label={label}>
        <TableHead>
          <TableRow>
            <TableCell>{label}</TableCell>
            {seasons.map(({ season, slug }) => (
              <TableCell key={slug} align="right">
                <MuiLink component={NextLink} prefetch={false} href={statsPath(slug)}>
                  {season}
                </MuiLink>
              </TableCell>
            ))}
            <TableCell align="right">All seasons</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.name}>
              <TableCell>{row.name}</TableCell>
              {row.values.map((value, index) => (
                <TableCell key={seasons[index].slug} align="right">
                  {value}
                </TableCell>
              ))}
              <TableCell align="right">
                <strong>{row.total}</strong>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function AllSeasonsStatsPage({ seasons }: { seasons: SeasonStats[] }) {
  const summaries = seasons.map((item) => item.summary);
  const counted = (pick: (summary: SeasonSummary) => number) => {
    const values = summaries.map(pick);
    return { values: values.map(n), total: n(sum(values)) };
  };
  const divisions = [...new Set(summaries.flatMap((summary) => summary.divisions.map((row) => row.division)))];
  const ofDivision = (summary: SeasonSummary, division: string) =>
    summary.divisions.find((row) => row.division === division) ?? { players: 0, eligible: 0 };

  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed string, with no data in it */}
      <script dangerouslySetInnerHTML={{ __html: HISTORY_RELOAD_SCRIPT }} />
      <Head>
        <title>Past season stats · USA Club Rugby Eligibility</title>
        <meta
          name="description"
          content="NCS eligibility across every USA Club Rugby senior club in each past season, from the Rugby Xplorer match record."
        />
      </Head>
      <Breadcrumbs aria-label="breadcrumb">
        <MuiLink component={NextLink} prefetch={false} href="/" underline="hover" color="inherit">
          All clubs
        </MuiLink>
        <Typography color="text.primary">Past season stats</Typography>
      </Breadcrumbs>
      <Typography variant="h4" component="h1" gutterBottom>
        Past season stats
      </Typography>
      {seasons.length === 0 ? (
        <Typography color="textSecondary">No past seasons are published yet.</Typography>
      ) : (
        <Stack spacing={3} useFlexGap>
          <Typography color="textSecondary">
            Every past season, each under its own year&apos;s rules. Open a season for its own page.
          </Typography>
          <BySeason
            label="The season"
            seasons={seasons}
            rows={[
              { name: 'Players', ...counted((summary) => summary.players) },
              { name: 'Counted matches', ...counted((summary) => summary.matches) },
              { name: 'Clubs', ...counted((summary) => summary.clubs) },
              { name: 'Clubs with more than one side', ...counted((summary) => summary.multiSideClubs) },
              { name: 'Sides', ...counted((summary) => summary.sides) },
              { name: 'Transfers', ...counted((summary) => summary.transfers) },
            ]}
          />
          <BySeason
            label="Eligible, by division"
            seasons={seasons}
            rows={divisions.map((division) => {
              const rows = summaries.map((summary) => ofDivision(summary, division));
              return {
                name: division,
                values: rows.map((row) => `${percent(row.eligible, row.players)} of ${n(row.players)}`),
                total: `${percent(sum(rows.map((row) => row.eligible)), sum(rows.map((row) => row.players)))} of ${n(sum(rows.map((row) => row.players)))}`,
              };
            })}
          />
          <BySeason
            label="Why players weren't eligible"
            seasons={seasons}
            rows={[
              { name: 'Not eligible for a side they played for', ...counted((summary) => summary.ineligible.verdicts) },
              { name: 'Short of the minimum', ...counted((summary) => summary.ineligible.shortOfMinimum) },
              { name: 'Reached the upper-side limit', ...counted((summary) => summary.ineligible.upperSideLimit) },
              { name: 'Too many matches for the sides above', ...counted((summary) => summary.ineligible.upperSideShare) },
            ]}
          />
          <BySeason
            label="Gaps in the record"
            seasons={seasons}
            rows={[
              { name: 'Results with no lineup', ...counted((summary) => summary.gaps.noLineup) },
              { name: 'Results with no substitutions entered', ...counted((summary) => summary.gaps.noSubstitutions) },
            ]}
          />
          <Typography variant="caption" color="text.secondary">
            &quot;All seasons&quot; adds the seasons together, so a player is counted once for each season they played,
            and once for each side they played for in the division table. A verdict can have more than one reason.
          </Typography>
        </Stack>
      )}
    </>
  );
}
