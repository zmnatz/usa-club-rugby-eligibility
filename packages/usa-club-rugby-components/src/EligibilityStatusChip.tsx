import Chip from '@mui/material/Chip';
import { type PlayerEligibility, type VerdictStatus, verdictStatus } from '@zmnatz/usa-club-rugby-data';

export interface EligibilityStatusChipProps {
  player: Pick<PlayerEligibility, 'eligible' | 'pending' | 'cautions'>;
  /** Names the side, e.g. "D1", where more than one verdict is shown. */
  sideLabel?: string;
  onClick?: () => void;
}

const CHIPS: Record<VerdictStatus, { color: 'error' | 'warning' | 'success'; text: string }> = {
  ineligible: { color: 'error', text: 'INELIGIBLE' },
  caution: { color: 'warning', text: 'CAUTION' },
  'on-track': { color: 'warning', text: 'ON TRACK' },
  eligible: { color: 'success', text: 'ELIGIBLE' },
};

/** A verdict as a chip: ineligible, caution (one upper-side match from losing the
 *  side for the season), on track (still needs matches) or eligible. */
export function EligibilityStatusChip({ player, sideLabel, onClick }: EligibilityStatusChipProps) {
  const { color, text } = CHIPS[verdictStatus(player)];
  return <Chip size="small" color={color} label={sideLabel ? `${sideLabel} ${text}` : text} onClick={onClick} />;
}

/** Marks a player who also played for another club that season. */
export function WaiverChip() {
  return <Chip size="small" color="warning" variant="outlined" label="Waiver Required" />;
}
