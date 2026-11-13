import { describe, expect, it } from 'bun:test';
import { prerenderedPlayerIds } from '../lib/serve.ts';

describe('prerenderedPlayerIds', () => {
  it('takes the player pages from the prerendered routes', () => {
    const routes = { '/': {}, '/club/x': {}, '/player/123': {}, '/player/456/': {}, '/player/7/extra': {} };
    expect(prerenderedPlayerIds({ routes })).toEqual(['123', '456']);
  });

  it('finds none in a manifest without routes', () => {
    expect(prerenderedPlayerIds({})).toEqual([]);
  });
});
