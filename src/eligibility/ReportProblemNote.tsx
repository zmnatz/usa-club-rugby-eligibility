import { useEligibilityLinks } from './links';

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
    <a href={href} target="_blank" rel="noopener noreferrer">
      {text}
    </a>
  );

  if (locked) {
    return (
      <p className="ec-muted ec-small">
        The {season} season is a Locked Season. Its verdicts come from that season’s rules and the team matching this page
        describes, so correcting Rugby Xplorer won’t change them. If the Match Record is right but a verdict looks wrong
        under those rules (a team in the wrong division or club, two names that should be one club, or a player marked
        Waiver Required who didn’t move):{' '}
        {link(reportProblem({ kind: 'rules-engine', season, club }), 'Report a verdict')}. If the season’s Match Record
        in the Archive is wrong, or was corrected in Rugby Xplorer after the season locked (a missing match, lineup or
        substitution):{' '}
        {link(reportProblem({ kind: 'archive-correction', season, club }), 'Report a record correction')}.
      </p>
    );
  }

  return (
    <p className="ec-muted ec-small">
      The data comes from Rugby Xplorer. If something looks wrong (missing matches, lineups or substitutions, or
      wrong team names or divisions), check and correct it in Rugby Xplorer first: corrections reach this report
      with its next nightly update. If Rugby Xplorer is right and this report is still wrong,{' '}
      {link(reportProblem(), 'report it')}.
    </p>
  );
}
