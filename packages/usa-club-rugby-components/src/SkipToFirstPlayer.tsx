import type { MouseEvent, Ref } from 'react';
import { SkipLink } from './primitives.tsx';

/** Where the link lands: the top player in the table on show, or the table's
 *  note that it has no players. */
export const FIRST_PLAYER_ID = 'first-player';

/** Takes a keyboard user past the page's controls to the first player. Render it
 *  before anything else that can take focus; it's off screen until focused. */
export function SkipToFirstPlayer({ ref }: { ref?: Ref<HTMLAnchorElement> }) {
  const skip = (event: MouseEvent) => {
    event.preventDefault();
    document.getElementById(FIRST_PLAYER_ID)?.focus();
  };

  return (
    <SkipLink ref={ref} href={`#${FIRST_PLAYER_ID}`} onClick={skip}>
      Skip to first player
    </SkipLink>
  );
}
