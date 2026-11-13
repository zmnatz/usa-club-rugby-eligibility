// The published changes page: the last few nightly data changes, newest first, each
// in a <details> accordion with an anchor. The nightly job adds an entry and the page
// itself is the history, so there is no separate data file.

export const START = '{/* changes:start */}';
export const END = '{/* changes:end */}';

/** How many updates the page keeps. */
export const KEEP = 14;

const withoutOpen = (html: string) => html.replace(/<details\s+open\b/, '<details');

const setOpen = (html: string, open: boolean) =>
  open ? withoutOpen(html).replace(/^<details/, '<details open') : withoutOpen(html);

function markers(page: string): { start: number; end: number } {
  const start = page.indexOf(START);
  const end = page.indexOf(END);
  if (start < 0 || end < 0 || end < start) {
    throw new Error(`The changes page needs ${START} before ${END}.`);
  }
  return { start, end };
}

/** The entries on the page, newest first. An entry has no nested <details>. */
export function readEntries(page: string): string[] {
  const { start, end } = markers(page);
  const body = page.slice(start + START.length, end);
  return [...body.matchAll(/<details\b[\s\S]*?<\/details>/g)].map((match) => match[0]);
}

function replaceEntries(page: string, entries: string[]): string {
  const { start, end } = markers(page);
  const block = entries.length > 0 ? `\n\n${entries.join('\n\n')}\n\n` : '\n';
  return `${page.slice(0, start + START.length)}${block}${page.slice(end)}`;
}

/** Adds an entry, replacing one with the same id, keeps the newest `KEEP`, and leaves
 *  only the newest open. */
export function addEntry(page: string, entry: string): { page: string; replaced: boolean } {
  const id = entry.match(/\bid="([^"]+)"/)?.[1];
  if (!id) throw new Error('The entry needs an id to anchor to.');
  const entries = readEntries(page);
  const marker = `id="${id}"`;
  const replaced = entries.some((html) => html.includes(marker));
  const kept = entries.filter((html) => !html.includes(marker));
  const next = [entry, ...kept].slice(0, KEEP).map((html, index) => setOpen(html, index === 0));
  return { page: replaceEntries(page, next), replaced };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-14" as "Nov 14, 2026", the same wherever it runs. */
export function formatDate(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) throw new Error(`Pass --date as YYYY-MM-DD, not "${day}".`);
  const [, year, month, date] = match;
  return `${MONTHS[Number(month) - 1]} ${Number(date)}, ${year}`;
}
