import { type PlayerEligibility, type VerdictStatus, verdictStatus } from '@zmnatz/usa-club-rugby-data';

export interface EligibilityStatusChipProps {
  player: Pick<PlayerEligibility, 'eligible' | 'pending' | 'cautions'>;
  /** Names the side, e.g. "D1", where more than one verdict is shown. */
  sideLabel?: string;
}

const CHIPS: Record<VerdictStatus, { tone: 'error' | 'warning' | 'success'; text: string }> = {
  ineligible: { tone: 'error', text: 'INELIGIBLE' },
  caution: { tone: 'warning', text: 'CAUTION' },
  'on-track': { tone: 'warning', text: 'ON TRACK' },
  eligible: { tone: 'success', text: 'ELIGIBLE' },
};

/** A verdict as a chip: ineligible, caution (one upper-side match from losing the
 *  side for the season), on track (still needs matches) or eligible. */
export function EligibilityStatusChip({ player, sideLabel }: EligibilityStatusChipProps) {
  const { tone, text } = CHIPS[verdictStatus(player)];
  return <span className={`ec-chip ec-chip--${tone}`}>{sideLabel ? `${sideLabel} ${text}` : text}</span>;
}

/** Marks a player who also played for another club that season. */
export function WaiverChip() {
  return <span className="ec-chip ec-chip--warning ec-chip--outlined">Waiver Required</span>;
}
