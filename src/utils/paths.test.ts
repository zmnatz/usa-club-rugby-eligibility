import { describe, expect, it } from 'bun:test';
import {
  legacyRedirect,
  playerPath,
  playerSeasonPath,
  reportProblemUrl,
  seasonClubPath,
  seasonPath,
  seasonsPath,
} from './paths';

describe('reportProblemUrl', () => {
  it('opens the issues with nothing to fill in', () => {
    expect(reportProblemUrl()).toBe('https://github.com/zmnatz/usa-club-rugby-eligibility/issues');
  });

  it('opens a new rules-engine issue filled in with the season and club', () => {
    const url = new URL(
      reportProblemUrl({ kind: 'rules-engine', season: '2024/2025', club: { key: 'harbor-city', name: 'Harbor City' } }),
    );
    expect(url.origin + url.pathname).toBe('https://github.com/zmnatz/usa-club-rugby-eligibility/issues/new');
    expect(url.searchParams.get('labels')).toBe('rules-engine');
    expect(url.searchParams.get('title')).toBe('Harbor City 2024/2025: ');
    expect(url.searchParams.get('body')).toContain('Kind: rules-engine');
    expect(url.searchParams.get('body')).toContain('Season: 2024/2025');
    expect(url.searchParams.get('body')).toContain('Club: Harbor City (`harbor-city`)');
  });

  it('opens an archive-correction issue for a whole season', () => {
    const url = new URL(reportProblemUrl({ kind: 'archive-correction', season: '2023/2024' }));
    expect(url.searchParams.get('labels')).toBe('archive-correction');
    expect(url.searchParams.get('title')).toBe('2023/2024: ');
    expect(url.searchParams.get('body')).toContain('Season: 2023/2024');
    expect(url.searchParams.get('body')).not.toContain('Club:');
  });
});

describe('player paths', () => {
  it('gives each player a page of their own, and one for each Locked Season they are in', () => {
    expect(playerPath('27ZCFXTnfWs8iEaz9')).toBe('/player/27ZCFXTnfWs8iEaz9');
    expect(playerSeasonPath('27ZCFXTnfWs8iEaz9', '2024-25')).toBe('/player/27ZCFXTnfWs8iEaz9/2024-25');
  });
});

describe('season paths', () => {
  it('gives the seasons, each season and each of its clubs a path', () => {
    expect(seasonsPath).toBe('/season');
    expect(seasonPath('2024-25')).toBe('/season/2024-25');
    expect(seasonClubPath('2024-25', 'harbor-city')).toBe('/season/2024-25/harbor-city');
  });
});

describe('legacyRedirect', () => {
  it('sends an old season or season club URL to its path', () => {
    expect(legacyRedirect('/season/', '?season=2024-25')).toBe('/season/2024-25/');
    expect(legacyRedirect('/season', '?season=2024-25&club=harbor-city')).toBe('/season/2024-25/harbor-city/');
  });

  it("sends a player opened over a club report to the player's page for that season", () => {
    expect(legacyRedirect('/club/harbor-city/', '?player=27ZCFX')).toBe('/player/27ZCFX/');
    expect(legacyRedirect('/season/2024-25/harbor-city/', '?player=27ZCFX')).toBe('/player/27ZCFX/2024-25/');
    expect(legacyRedirect('/season/', '?season=2024-25&club=harbor-city&player=27ZCFX')).toBe('/player/27ZCFX/2024-25/');
  });

  it("sends a player page's season tab to the season's path", () => {
    expect(legacyRedirect('/player/27ZCFX/', '?season=2024-25')).toBe('/player/27ZCFX/2024-25/');
    expect(legacyRedirect('/player/27ZCFX', '?season=current')).toBe('/player/27ZCFX/');
  });

  it('sends a /player/?id=<cms-id> URL to the player\'s page', () => {
    expect(legacyRedirect('/player/', '?id=27ZCFX')).toBe('/player/27ZCFX/');
    expect(legacyRedirect('/player', '?id=27ZCFX')).toBe('/player/27ZCFX/');
  });

  it('leaves every other URL alone', () => {
    expect(legacyRedirect('/season/', '')).toBeNull();
    expect(legacyRedirect('/season/', '?season=')).toBeNull();
    expect(legacyRedirect('/season/', '?club=harbor-city')).toBeNull();
    expect(legacyRedirect('/club/harbor-city/', '')).toBeNull();
    expect(legacyRedirect('/club/harbor-city/', '?player=')).toBeNull();
    expect(legacyRedirect('/player/', '')).toBeNull();
    expect(legacyRedirect('/player/27ZCFX/', '')).toBeNull();
    expect(legacyRedirect('/player/27ZCFX/2024-25/', '?season=2023-24')).toBeNull();
    expect(legacyRedirect('/methodology/', '?player=27ZCFX')).toBeNull();
    expect(legacyRedirect('/club/%E0/', '?player=27ZCFX')).toBeNull();
  });
});
