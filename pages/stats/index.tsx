import type { GetStaticProps } from 'next';
import Head from 'next/head';
import { type SeasonSummary, seasonSummary } from '@zmnatz/usa-club-rugby-data';
import { Crumbs, PageLink } from '@/components/Crumbs';
import { statsPath } from '@/utils/paths';
import { published } from '@/utils/published';

// Every Locked Season's stats side by side, worked out at build time like each
// season's own stats page.

interface SeasonStats {
  season: string;
  slug: string;
  summary: SeasonSummary;
}

export const getStaticProps: GetStaticProps<{ seasons: SeasonStats[] }> = async () => ({
  props: {
    seasons: await Promise.all(
      (await published.seasons()).map(async ({ slug }) => {
        const file = await published.season(slug);
        return { season: file.season, slug, summary: seasonSummary(file) };
      }),
    ),
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
    <div className="ec-table-wrap ec-table-outlined">
      <table className="ec-table" aria-label={label}>
        <thead>
          <tr>
            <th>{label}</th>
            {seasons.map(({ season, slug }) => (
              <th key={slug} className="ec-num">
                <PageLink href={statsPath(slug)}>{season}</PageLink>
              </th>
            ))}
            <th className="ec-num">All seasons</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              {row.values.map((value, index) => (
                <td key={seasons[index].slug} className="ec-num">
                  {value}
                </td>
              ))}
              <td className="ec-num">
                <strong>{row.total}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
      <Head>
        <title>Past season stats · USA Club Rugby Eligibility</title>
        <meta
          name="description"
          content="NCS eligibility across every USA Club Rugby senior club in each past season, from the Rugby Xplorer match record."
        />
      </Head>
      <Crumbs trail={[{ label: 'All clubs', href: '/' }, { label: 'Past season stats' }]} />
      <h1>Past season stats</h1>
      {seasons.length === 0 ? (
        <p className="lead">No past seasons are published yet.</p>
      ) : (
        <div className="ec-stack">
          <p className="lead" style={{ margin: 0 }}>
            Every past season, each under its own year&apos;s rules. Open a season for its own page.
          </p>
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
              { name: 'Ineligible (one per player and side)', ...counted((summary) => summary.ineligible.verdicts) },
              { name: 'Too few matches at or below the side', ...counted((summary) => summary.ineligible.shortOfMinimum) },
              { name: 'Played too many matches for an upper side', ...counted((summary) => summary.ineligible.upperSideLimit) },
              { name: 'Played more for upper sides than for the side', ...counted((summary) => summary.ineligible.upperSideShare) },
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
          <span className="ec-caption ec-muted">
            &quot;All seasons&quot; adds the seasons together, so a player is counted once for each season they played,
            and once for each side they played for in the division table. A verdict can have more than one reason.
          </span>
        </div>
      )}
    </>
  );
}
