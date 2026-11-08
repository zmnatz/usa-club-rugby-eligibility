import { describe, expect, it } from 'bun:test';
import { selectClubs } from './buildScope';

const clubs = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
// Both are always passed, so the machine's own environment can't change a result.
const keysFor = (scope: string, ci = '') => selectClubs(clubs, { scope, ci }).map((club) => club.key);

describe('selectClubs', () => {
  it('builds every club by default', () => {
    expect(keysFor('')).toEqual(['a', 'b', 'c']);
    expect(keysFor('  ')).toEqual(['a', 'b', 'c']);
  });

  it('takes a number of clubs from the start', () => {
    expect(keysFor('2')).toEqual(['a', 'b']);
  });

  it('takes clubs by key', () => {
    expect(keysFor('c, a')).toEqual(['a', 'c']);
  });

  it('fails on a club that does not exist', () => {
    expect(() => keysFor('a,nope')).toThrow('nope');
  });

  it('ignores the scope in CI, so a deployed site is complete', () => {
    expect(keysFor('1', 'true')).toEqual(['a', 'b', 'c']);
  });
});
