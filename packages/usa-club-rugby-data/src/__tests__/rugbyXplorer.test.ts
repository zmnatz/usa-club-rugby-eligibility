import { describe, expect, it } from 'vitest';
import { crestEntityId, matchUrl } from '../rugbyXplorer.ts';

describe('matchUrl', () => {
  it('links to the match report under the Senior Club Council, since a report loads under any entity', () => {
    expect(matchUrl('abc')).toBe(
      'https://xplorer.rugby/senior-club-council/match-centre/abc?tab=Points-Summary',
    );
  });

  it("uses a club's page when one is given", () => {
    expect(matchUrl('3c5fe054e0873dae1', 'rocky-gorge-rugby')).toBe(
      'https://xplorer.rugby/rocky-gorge-rugby/match-centre/3c5fe054e0873dae1?tab=Points-Summary',
    );
  });
});

describe('crestEntityId', () => {
  it('reads the club id from a CMS crest URL', () => {
    expect(crestEntityId('https://dpf0m541u9zk8.cloudfront.net/ru/team/91273.png?v=1712684240196')).toBe('91273');
  });

  it('has none for a crest stored elsewhere, or no crest', () => {
    expect(crestEntityId('https://d26phqdbpt0w91.cloudfront.net/NonVideo/d89f330c.png')).toBeNull();
    expect(crestEntityId('')).toBeNull();
    expect(crestEntityId(null)).toBeNull();
  });
});
