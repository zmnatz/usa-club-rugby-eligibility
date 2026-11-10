import { Stack, Typography } from '@mui/material';
import { describeRules, rulesForSeason } from '@zmnatz/usa-club-rugby-data';

export interface SeasonRulesProps {
  /** As the CMS names it, e.g. "2024/2025". */
  season: string;
}

/** The rules a season's verdicts were worked out under, in a few sentences. */
export function SeasonRules({ season }: SeasonRulesProps) {
  return (
    <section>
      <Typography variant="subtitle1" component="h2" gutterBottom>
        The {season} rules
      </Typography>
      <Stack component="ul" spacing={0.5} useFlexGap sx={{ m: 0, pl: 3 }}>
        {describeRules(rulesForSeason(season)).map((line) => (
          <Typography key={line} component="li" variant="body2">
            {line}
          </Typography>
        ))}
      </Stack>
    </section>
  );
}
