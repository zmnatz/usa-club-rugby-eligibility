/**
 * Pages served without Next's runtime JavaScript cannot re-render when the
 * browser moves through history. A client-side navigation into one (the Next
 * router runs `history.pushState`) makes a same-document history entry, so after
 * a hard refresh the exported page has no router: back and forward change the URL
 * and leave the page on screen, e.g. a club's player page stays up at the club's
 * URL. Reloading loads the page the URL now names.
 *
 * React never runs a `<script>` it renders during a client-side navigation, where
 * the router already handles history, so this runs only in the exported HTML.
 */
export const HISTORY_RELOAD_SCRIPT = 'addEventListener("popstate", () => location.reload());';
