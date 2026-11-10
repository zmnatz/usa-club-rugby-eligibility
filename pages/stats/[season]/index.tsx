import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import { ReportProblemNote, SeasonRules } from '@/eligibility';
import { type SeasonSummary, seasonSummary } from '@zmnatz/usa-club-rugby-data';
import { Crumbs, PageLink } from '@/components/Crumbs';
import { HISTORY_RELOAD_SCRIPT } from '@/utils/historyReload';
import { seasonPath, statsPath } from '@/utils/paths';
import { published } from '@/utils/published';

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
  paths: (await published.seasons()).map(({ slug }) => ({ params: { season: slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<StatsProps> = async ({ params }) => {
  if (typeof params?.season !== 'string') return { notFound: true };
  const file = await published.season(params.season);
  return { props: { season: file.season, slug: file.slug, summary: seasonSummary(file) } };
};

const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
const percent = (part: number, whole: number) => (whole === 0 ? '—' : `${Math.round((100 * part) / whole)}%`);

/** The season's verdicts counted across every club. */
function SeasonStatsBody({ summary }: { summary: SeasonSummary }) {
  const { ineligible, gaps } = summary;
  return (
    <div className="ec-stack">
      <p className="ec-small" style={{ margin: 0 }}>
        {count(summary.players, 'player')} played {count(summary.matches, 'counted match', 'counted matches')} for{' '}
        {count(summary.clubs, 'club')}, {summary.multiSideClubs.toLocaleString('en-US')} of them with more than one side (
        {count(summary.sides, 'side')} in all), with {count(summary.transfers, 'transfer')} between clubs.
      </p>
      <div className="ec-table-wrap ec-table-outlined">
        <table className="ec-table" aria-label="Eligibility by division">
          <thead>
            <tr>
              <th>Division</th>
              <th className="ec-num">Sides</th>
              <th className="ec-num">Players</th>
              <th className="ec-num">Eligible</th>
              <th className="ec-num">Share</th>
            </tr>
          </thead>
          <tbody>
            {summary.divisions.map((row) => (
              <tr key={row.division}>
                <td>{row.division}</td>
                <td className="ec-num">{row.sides.toLocaleString('en-US')}</td>
                <td className="ec-num">{row.players.toLocaleString('en-US')}</td>
                <td className="ec-num">{row.eligible.toLocaleString('en-US')}</td>
                <td className="ec-num">{percent(row.eligible, row.players)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <span className="ec-caption ec-muted">
        Players are counted for each side they played for, so a player at a club with several sides can appear in more
        than one division.
      </span>
      {ineligible.verdicts > 0 && (
        <p className="ec-small" style={{ margin: 0 }}>
          {ineligible.verdicts === 1 ? 'There was' : 'There were'} {count(ineligible.verdicts, 'ineligible verdict')}, one for
          each player and side they were ineligible for.{' '}
          {ineligible.shortOfMinimum.toLocaleString('en-US')} were short of the minimum,{' '}
          {ineligible.upperSideLimit.toLocaleString('en-US')} reached the upper-side limit and{' '}
          {ineligible.upperSideShare.toLocaleString('en-US')} had too many matches for the sides above. Some had more than
          one reason.
        </p>
      )}
      <p className="ec-small ec-muted" style={{ margin: 0 }}>
        Gaps in the record: {count(gaps.noLineup, 'result')} with no lineup and {count(gaps.noSubstitutions, 'result')} with
        no substitutions entered. Players in those matches may be undercounted.
      </p>
    </div>
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
      <Crumbs
        trail={[{ label: 'All clubs', href: '/' }, { label: 'Past season stats', href: statsPath('') }, { label: season }]}
      />
      <h1>{season} season stats</h1>
      <div className="ec-stack">
        <SeasonStatsBody summary={summary} />
        <SeasonRules season={season} />
        <ReportProblemNote season={season} locked />
        <p className="ec-small" style={{ margin: 0 }}>
          <PageLink href={seasonPath(slug)}>See each club&apos;s verdicts for {season}</PageLink>
        </p>
      </div>
    </>
  );
}
