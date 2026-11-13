import { useEffect, useRef } from 'react';
import {
  hasSharedName,
  playerFixtures,
  sharedNames,
  type EligibilityBreakdown,
  type FeedFixture,
  type ParticipationSnapshot,
  type PublishedClub,
} from '@zmnatz/usa-club-rugby-data';
import { useEligibilityLinks } from './links.tsx';
import { PlayerDetailBody, PlayerDetailHeading } from './PlayerDetail.tsx';

export interface PlayerDialogProps {
  club: PublishedClub;
  /** The club's saved Match Record. */
  saved: ParticipationSnapshot;
  fixtures: FeedFixture[];
  breakdown: EligibilityBreakdown;
  /** The player and the side whose verdict to show. */
  selected: { playerId: string; teamName: string };
  /** The player's own page, linked from the dialog. A Locked Season's players have none. */
  pageHref?: string;
  onClose: () => void;
}

/** A player's verdict and games in a club's report, in a modal dialog. The dialog is
 *  the platform's: it traps focus, closes on Escape and returns focus to the name that
 *  opened it. */
export function PlayerDialog({ club, saved, fixtures, breakdown, selected, pageHref, onClose }: PlayerDialogProps) {
  const { Link } = useEligibilityLinks();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const side = breakdown.sides.find((entry) => entry.teamName === selected.teamName);
  const player = side?.players.find((candidate) => candidate.playerId === selected.playerId);
  const otherClubs = saved.transfers?.[selected.playerId] ?? [];

  return (
    // Escape closes the dialog natively, so the backdrop click needs no key handler.
    // biome-ignore lint/a11y/useKeyWithClickEvents: the backdrop click is a convenience
    <dialog
      ref={ref}
      className="ec-dialog"
      aria-label={player ? `${player.name}, ${side?.label}` : 'Player'}
      onClose={onClose}
      // A click on the backdrop lands on the dialog itself, not its content.
      onClick={(event) => event.target === ref.current && ref.current?.close()}
    >
      {side && player && (
        <div className="ec-stack">
          <div className="ec-row" style={{ justifyContent: 'space-between' }}>
            <PlayerDetailHeading
              player={player}
              source="record"
              showCmsId={hasSharedName(player, sharedNames(side.players))}
              otherClubs={otherClubs}
            />
            <button type="button" className="ec-btn" onClick={() => ref.current?.close()}>
              Close
            </button>
          </div>
          <p className="ec-muted ec-small" style={{ margin: 0 }}>
            {club.name} · {saved.season} season
            {pageHref && (
              <>
                {' · '}
                <Link href={pageHref}>Open player page</Link>
              </>
            )}
          </p>
          <PlayerDetailBody
            player={player}
            source="record"
            ownLabel={side.label}
            fixtures={playerFixtures(player, { club, snapshot: saved, fixtures })}
            otherClubs={otherClubs}
          />
        </div>
      )}
    </dialog>
  );
}
