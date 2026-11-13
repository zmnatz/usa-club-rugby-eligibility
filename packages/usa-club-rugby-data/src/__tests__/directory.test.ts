import { describe, expect, it } from 'vitest';
import type { FixtureSides } from '../clubFixtures.ts';
import { clubsWithoutFixtures } from '../directory.ts';
import type { PublishedClub } from '../published.ts';

const club = (key: string, name: string, ...teamNames: string[]): PublishedClub => ({
  key,
  name,
  sides: teamNames.map((teamName) => ({ teamName, label: 'D3' })),
});

const fixture = (compName: string, home: string, away = 'Opponent MD3'): FixtureSides => ({
  compName,
  homeTeam: { name: home },
  awayTeam: { name: away },
});

const keysOf = (clubs: PublishedClub[]) => clubs.map((found) => found.key);

describe('clubsWithoutFixtures', () => {
  const currentClubs = [
    club('bayside', 'Bayside', 'Bayside MD3'),
    club('amoskeag-rugby', 'Amoskeag Rugby', 'Amoskeag Rugby MD3'),
  ];
  const current = { clubs: currentClubs, fixtures: [] };
  const previous = (...clubs: PublishedClub[]) => ({ clubs, fixtures: [] });

  it("lists last season's clubs that have no fixtures this season, by name", () => {
    const found = clubsWithoutFixtures(
      current,
      previous(club('zephyr', 'Zephyr', 'Zephyr MD3'), club('bayside', 'Bayside', 'Bayside MD3'), club('harbor', 'Harbor', 'Harbor MD3')),
    );
    expect(keysOf(found)).toEqual(['harbor', 'zephyr']);
  });

  it('leaves out a club with a team of the same name this season, under another club name', () => {
    expect(clubsWithoutFixtures(current, previous(club('old-bayside', 'Old Bayside', 'Bayside MD3')))).toEqual([]);
  });

  it('leaves out a club that only gained or lost "Rugby" or "RFC" in its name', () => {
    const found = clubsWithoutFixtures(
      current,
      previous(club('amoskeag', 'Amoskeag', 'Amoskeag MD3'), club('bayside-rfc', 'Bayside RFC', 'Bayside RFC MD3')),
    );
    expect(found).toEqual([]);
  });

  it('lists nothing without a previous season', () => {
    expect(clubsWithoutFixtures(current, previous())).toEqual([]);
  });

  describe('a similar name in the same competition and division', () => {
    const thisSeason = {
      clubs: [
        club('bayonne-bombers', 'Bayonne Bombers', 'Bayonne Bombers MD3'),
        club('colorado-springs-grizzlies', 'Colorado Springs Grizzlies', 'Colorado Springs Grizzlies MD3'),
        club('raleigh-women', 'Raleigh Women', 'Raleigh WD3'),
      ],
      fixtures: [
        fixture('2027 Midwest Men’s D3 - Ohio', 'Bayonne Bombers MD3'),
        fixture('2027 Rocky Mountain Men’s D3', 'Colorado Springs Grizzlies MD3'),
        fixture('2027 Midwest Women’s D3 - Ohio', 'Raleigh WD3'),
      ],
    };

    it('is the same club, across a change in how the competition is named', () => {
      const found = clubsWithoutFixtures(thisSeason, {
        clubs: [club('bayonne', 'Bayonne', 'Bayonne MD3')],
        fixtures: [fixture('2025-26 MW Men’s D3 - Ohio League', 'Bayonne MD3')],
      });
      expect(found).toEqual([]);
    });

    it('is the same club when a long word has one letter slipped', () => {
      const found = clubsWithoutFixtures(thisSeason, {
        clubs: [club('colorado-springs-grizziles', 'Colorado Springs Grizziles', 'Colorado Springs Grizziles MD3')],
        fixtures: [fixture('2026 Rocky Mountain Men’s D3', 'Colorado Springs Grizziles MD3')],
      });
      expect(found).toEqual([]);
    });

    it('is a different club in another competition', () => {
      const found = clubsWithoutFixtures(thisSeason, {
        clubs: [club('bayonne', 'Bayonne', 'Bayonne MD3')],
        fixtures: [fixture('2026 Empire Men’s D3', 'Bayonne MD3')],
      });
      expect(keysOf(found)).toEqual(['bayonne']);
    });

    it('is a different club when the names only share a word', () => {
      const found = clubsWithoutFixtures(thisSeason, {
        clubs: [club('colorado-flamingos', 'Northern Colorado Flamingos', 'Northern Colorado Flamingos MD3')],
        fixtures: [fixture('2026 Rocky Mountain Men’s D3', 'Northern Colorado Flamingos MD3')],
      });
      expect(keysOf(found)).toEqual(['colorado-flamingos']);
    });

    it("is a different club when it is the other gender's", () => {
      const found = clubsWithoutFixtures(thisSeason, {
        clubs: [club('raleigh', 'Raleigh', 'Raleigh MD3')],
        fixtures: [fixture('2027 Midwest Women’s D3 - Ohio', 'Raleigh MD3')],
      });
      expect(keysOf(found)).toEqual(['raleigh']);
    });
  });
});
