import { describe, expect, it } from 'bun:test';
import { reportProblemUrl } from './paths';

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
