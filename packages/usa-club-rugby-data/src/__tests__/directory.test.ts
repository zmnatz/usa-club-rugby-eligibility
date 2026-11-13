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

  describe('a club new this season with a similar name, in the same division', () => {
    const thisSeason = {
      clubs: [
        club('bayonne-bombers', 'Bayonne Bombers', 'Bayonne Bombers MD3'),
        club('colorado-springs-grizzlies', 'Colorado Springs Grizzlies', 'Colorado Springs Grizzlies MD3'),
        club('raleigh', 'Raleigh', 'Raleigh MD3'),
        club('denver-black-ice', 'Denver Black Ice', 'Denver Black Ice D3'),
        club('dayton', 'Dayton', 'Dayton MD3'),
        club('bucks', 'Bucks', 'Bucks MD3'),
        club('kansas-city', 'Kansas City', 'Kansas City MD3'),
      ],
      fixtures: [fixture("RMRU Women's 2027 - D3", 'Denver Black Ice D3', 'Other WD3')],
    };
    const lastSeason = (...clubs: PublishedClub[]) => ({
      clubs: [...clubs, club('kansas-city', 'Kansas City', 'Kansas City MD3')],
      fixtures: [fixture("RMRU Women's 2026 D3", 'Black Ice WD3', 'Other WD3')],
    });

    it('is the club renamed, even when its competition was renamed too', () => {
      const found = clubsWithoutFixtures(
        thisSeason,
        lastSeason(club('raleigh-vipers', 'Raleigh Vipers', 'Raleigh Vipers MD3'), club('bayonne', 'Bayonne', 'Bayonne MD3')),
      );
      expect(found).toEqual([]);
    });

    it('is the club renamed when a long word has one letter slipped', () => {
      const found = clubsWithoutFixtures(
        thisSeason,
        lastSeason(club('colorado-springs-grizziles', 'Colorado Springs Grizziles', 'Colorado Springs Grizziles MD3')),
      );
      expect(found).toEqual([]);
    });

    it("knows a women's side from its competition when its name doesn't say", () => {
      const found = clubsWithoutFixtures(thisSeason, lastSeason(club('black-ice-women', 'Black Ice Women', 'Black Ice WD3')));
      expect(found).toEqual([]);
    });

    it("is a different club when it is the other gender's", () => {
      const found = clubsWithoutFixtures(thisSeason, lastSeason(club('raleigh-women', 'Raleigh Women', 'Raleigh WD3')));
      expect(keysOf(found)).toEqual(['raleigh-women']);
    });

    it('is a different club in another division', () => {
      const found = clubsWithoutFixtures(thisSeason, lastSeason({ key: 'bayonne', name: 'Bayonne', sides: [{ teamName: 'Bayonne MD2', label: 'D2' }] }));
      expect(keysOf(found)).toEqual(['bayonne']);
    });

    it('is a different club when the names only share a word, or are a slip apart', () => {
      const found = clubsWithoutFixtures(
        thisSeason,
        lastSeason(
          club('northern-colorado-flamingos', 'Northern Colorado Flamingos', 'Northern Colorado Flamingos MD3'),
          club('daytona-beach', 'Daytona Beach', 'Daytona Beach MD3'),
        ),
      );
      expect(keysOf(found)).toEqual(['daytona-beach', 'northern-colorado-flamingos']);
    });

    it('is not a club that was there last season too', () => {
      const found = clubsWithoutFixtures(thisSeason, lastSeason(club('kansas-city-blues', 'Kansas City Blues', 'Kansas City Blues MD3')));
      expect(keysOf(found)).toEqual(['kansas-city-blues']);
    });

    it('lists them all when the new club looks like several', () => {
      const found = clubsWithoutFixtures(
        thisSeason,
        lastSeason(club('atlanta-bucks', 'Atlanta Bucks', 'Atlanta Bucks MD3'), club('montgomery-bucks', 'Montgomery Bucks', 'Montgomery Bucks MD3')),
      );
      expect(keysOf(found)).toEqual(['atlanta-bucks', 'montgomery-bucks']);
    });
  });
});
