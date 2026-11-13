import { describe, expect, it } from 'bun:test';
import { legacySeasonRedirect, playerPath, queryPlayerId, reportProblemUrl, seasonClubPath, seasonPath, seasonsPath } from './paths';

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
  it('gives each player a page of their own', () => {
    expect(playerPath('27ZCFXTnfWs8iEaz9')).toBe('/player/27ZCFXTnfWs8iEaz9');
  });

  it('reads the player from a /player/?id=<cms-id> URL, and nothing else', () => {
    expect(queryPlayerId('/player/', '?id=27ZCFXTnfWs8iEaz9')).toBe('27ZCFXTnfWs8iEaz9');
    expect(queryPlayerId('/player', '?id=27ZCFXTnfWs8iEaz9')).toBe('27ZCFXTnfWs8iEaz9');
    expect(queryPlayerId('/player/', '')).toBeNull();
    expect(queryPlayerId('/player/', '?id=')).toBeNull();
    expect(queryPlayerId('/club/nova/', '?id=x')).toBeNull();
  });
});

describe('season paths', () => {
  it('gives the seasons, each season and each of its clubs a path', () => {
    expect(seasonsPath).toBe('/season');
    expect(seasonPath('2024-25')).toBe('/season/2024-25');
    expect(seasonClubPath('2024-25', 'harbor-city')).toBe('/season/2024-25/harbor-city');
  });

  it('sends an old ?season=&club= URL to its path, keeping any other query', () => {
    expect(legacySeasonRedirect('?season=2024-25')).toBe('/season/2024-25/');
    expect(legacySeasonRedirect('?season=2024-25&club=harbor-city')).toBe('/season/2024-25/harbor-city/');
    expect(legacySeasonRedirect('?season=2024-25&club=harbor-city&player=27ZCFX')).toBe(
      '/season/2024-25/harbor-city/?player=27ZCFX',
    );
  });

  it('leaves a URL with no season alone', () => {
    expect(legacySeasonRedirect('')).toBeNull();
    expect(legacySeasonRedirect('?season=')).toBeNull();
    expect(legacySeasonRedirect('?club=harbor-city')).toBeNull();
  });
});
