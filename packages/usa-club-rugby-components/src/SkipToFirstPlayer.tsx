/** Where the link lands: the top player in the table on show, or the table's
 *  note that it has no players. */
export const FIRST_PLAYER_ID = 'first-player';

/** Takes a keyboard user past the page's controls to the first player. A plain link to
 *  a focusable row, so it needs no script. Render it before anything else that can
 *  take focus; it's off screen until focused. */
export function SkipToFirstPlayer() {
  return (
    <a className="ec-skip" href={`#${FIRST_PLAYER_ID}`}>
      Skip to first player
    </a>
  );
}
