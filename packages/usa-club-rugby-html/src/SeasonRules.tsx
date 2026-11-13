import { describeRules, rulesForSeason } from '@zmnatz/usa-club-rugby-data';

export interface SeasonRulesProps {
  /** As the CMS names it, e.g. "2024/2025". */
  season: string;
}

/** The rules a season's verdicts were worked out under, in a few sentences. */
export function SeasonRules({ season }: SeasonRulesProps) {
  return (
    <section>
      <h2 className="ec-small" style={{ margin: '0 0 8px', fontSize: '1rem' }}>
        The {season} rules
      </h2>
      <ul className="ec-list ec-small">
        {describeRules(rulesForSeason(season)).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
