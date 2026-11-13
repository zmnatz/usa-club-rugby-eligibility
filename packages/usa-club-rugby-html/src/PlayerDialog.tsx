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
import { EligibilityStatusChip, WaiverChip } from './EligibilityStatusChip.tsx';
import { PlayerDetailBody, PlayerDetailHeading } from './PlayerDetail.tsx';

export interface PlayerDialogProps {
  club: PublishedClub;
  /** The club's saved Match Record. */
  saved: ParticipationSnapshot;
  fixtures: FeedFixture[];
  breakdown: EligibilityBreakdown;
  /** The player to show, on every side of the club they're listed for. */
  playerId: string;
  /** The player's own page, linked from the dialog. A Locked Season's players have none. */
  pageHref?: string;
  onClose: () => void;
}

/** The sides a player is listed on in a club's breakdown, with their verdict on each,
 *  as on their own page. */
export const playerSides = (breakdown: EligibilityBreakdown, playerId: string) =>
  breakdown.sides.flatMap((side) => {
    const player = side.players.find((candidate) => candidate.playerId === playerId);
    return player ? [{ side, player }] : [];
  });

/** A player's verdict and games in a club's report, in a modal dialog: one section per
 *  side they're listed for. The dialog is the platform's: it traps focus, closes on
 *  Escape and returns focus to the name that opened it. */
export function PlayerDialog({ club, saved, fixtures, breakdown, playerId, pageHref, onClose }: PlayerDialogProps) {
  const { Link } = useEligibilityLinks();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const entries = playerSides(breakdown, playerId);
  const otherClubs = saved.transfers?.[playerId] ?? [];
  const [first] = entries;
  const oneSide = entries.length === 1;

  return (
    // Escape closes the dialog natively, so the backdrop click needs no key handler.
    // biome-ignore lint/a11y/useKeyWithClickEvents: the backdrop click is a convenience
    <dialog
      ref={ref}
      className="ec-dialog"
      aria-label={first ? (oneSide ? `${first.player.name}, ${first.side.label}` : first.player.name) : 'Player'}
      onClose={onClose}
      // A click on the backdrop lands on the dialog itself, not its content.
      onClick={(event) => event.target === ref.current && ref.current?.close()}
    >
      {first && (
        <div className="ec-stack">
          <div className="ec-row" style={{ justifyContent: 'space-between' }}>
            {oneSide ? (
              <PlayerDetailHeading
                player={first.player}
                source="record"
                showCmsId={hasSharedName(first.player, sharedNames(first.side.players))}
                otherClubs={otherClubs}
              />
            ) : (
              <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>{first.player.name}</span>
            )}
            <button type="button" className="ec-btn" onClick={() => ref.current?.close()}>
              Close
            </button>
          </div>
          <p className="ec-muted ec-small" style={{ margin: 0 }}>
            {club.name} · {saved.season} season
            {!oneSide && ` · listed for ${entries.length} sides, each assessed on its own`}
            {pageHref && (
              <>
                {' · '}
                <Link href={pageHref}>Open player page</Link>
              </>
            )}
          </p>
          {entries.map(({ side, player }) => (
            <section key={side.teamName} className="ec-stack" aria-label={oneSide ? undefined : `${side.label} side`}>
              {!oneSide && (
                <div className="ec-row">
                  <h3 style={{ margin: 0 }}>{side.label} side</h3>
                  <EligibilityStatusChip player={player} />
                  {otherClubs.length > 0 && <WaiverChip />}
                </div>
              )}
              <PlayerDetailBody
                player={player}
                source="record"
                ownLabel={side.label}
                fixtures={playerFixtures(player, { club, snapshot: saved, fixtures })}
                otherClubs={otherClubs}
              />
            </section>
          ))}
        </div>
      )}
    </dialog>
  );
}
