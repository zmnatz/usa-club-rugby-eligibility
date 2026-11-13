import { describe, expect, it } from 'vitest';
import { clubsWithoutFixtures } from '../directory.ts';
import type { PublishedClub } from '../published.ts';

const club = (key: string, name: string, ...teamNames: string[]): PublishedClub => ({
  key,
  name,
  sides: teamNames.map((teamName) => ({ teamName, label: 'D3' })),
});

describe('clubsWithoutFixtures', () => {
  const current = [club('bayside', 'Bayside', 'Bayside MD3'), club('amoskeag-rugby', 'Amoskeag Rugby', 'Amoskeag Rugby MD3')];

  it("lists last season's clubs that have no fixtures this season, by name", () => {
    const previous = [club('zephyr', 'Zephyr', 'Zephyr MD3'), club('bayside', 'Bayside', 'Bayside MD3'), club('harbor', 'Harbor', 'Harbor MD3')];
    expect(clubsWithoutFixtures(current, previous).map((found) => found.key)).toEqual(['harbor', 'zephyr']);
  });

  it('leaves out a club with a team of the same name this season, under another club name', () => {
    const previous = [club('old-bayside', 'Old Bayside', 'Bayside MD3')];
    expect(clubsWithoutFixtures(current, previous)).toEqual([]);
  });

  it('leaves out a club that only gained or lost "Rugby" or "RFC" in its name', () => {
    const previous = [club('amoskeag', 'Amoskeag', 'Amoskeag MD3'), club('bayside-rfc', 'Bayside RFC', 'Bayside RFC MD3')];
    expect(clubsWithoutFixtures(current, previous)).toEqual([]);
  });

  it('lists nothing without a previous season', () => {
    expect(clubsWithoutFixtures(current, [])).toEqual([]);
  });
});
