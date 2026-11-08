/**
 * Which clubs a build generates pages for. Set `BUILD_CLUBS` for a quicker local
 * build: a number takes that many clubs from the start of the list, and a
 * comma-separated list names them by club key. Unset builds every club, and so does
 * CI, so a deployed site is always complete.
 */
export function selectClubs<Club extends { key: string }>(
  clubs: Club[],
  { scope = process.env.BUILD_CLUBS, ci = process.env.GITHUB_ACTIONS }: { scope?: string; ci?: string } = {},
): Club[] {
  const wanted = scope?.trim();
  if (!wanted || ci) return clubs;
  if (/^\d+$/.test(wanted)) return clubs.slice(0, Number(wanted));

  const keys = wanted.split(',').map((key) => key.trim());
  const unknown = keys.filter((key) => !clubs.some((club) => club.key === key));
  if (unknown.length > 0) throw new Error(`BUILD_CLUBS names unknown clubs: ${unknown.join(', ')}`);
  return clubs.filter((club) => keys.includes(club.key));
}
