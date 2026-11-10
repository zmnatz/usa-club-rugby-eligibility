import { Link as MuiLink, Typography } from '@mui/material';
import { useEligibilityLinks } from './links.tsx';

export interface ReportProblemNoteProps {
  /** As the CMS names it, e.g. "2024/2025". */
  season: string;
  /** The club the page is about, if any. */
  club?: { key: string; name: string };
  /** A Locked Season, which a Rugby Xplorer correction no longer changes. */
  locked?: boolean;
}

/** Where to take a report that looks wrong. Shows only when the host gives a
 *  `reportProblem` route. */
export function ReportProblemNote({ season, club, locked = false }: ReportProblemNoteProps) {
  const { routes } = useEligibilityLinks();
  const reportProblem = routes.reportProblem;
  if (!reportProblem) return null;

  const link = (href: string, text: string) => (
    <MuiLink href={href} target="_blank" rel="noopener noreferrer">
      {text}
    </MuiLink>
  );

  return (
    <Typography variant="body2" color="textSecondary" gutterBottom>
      The data comes from Rugby Xplorer. If something looks wrong (missing matches, lineups or substitutions, or
      wrong team names or divisions), check and correct it in Rugby Xplorer first: corrections reach this report
      with its next nightly update. If Rugby Xplorer is right and this report is still wrong,{' '}
      {link(reportProblem(), 'open an issue')}.
    </Typography>
  );
}
