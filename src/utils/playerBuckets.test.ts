import { describe, expect, it } from 'bun:test';
import { PLAYER_BUCKETS, playerBucket, playerBucketFile } from './playerBuckets';

describe('playerBucket', () => {
  it('names a bucket as two hex digits, the same every time', () => {
    const bucket = playerBucket('27ZCFXTnfWs8iEaz9');
    expect(bucket).toMatch(/^[0-9a-f]{2}$/);
    expect(playerBucket('27ZCFXTnfWs8iEaz9')).toBe(bucket);
    expect(playerBucketFile(bucket)).toBe(`player-data/${bucket}.json`);
  });

  it('spreads ids over every bucket roughly evenly', () => {
    const counts = new Map<string, number>();
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let seed = 1;
    for (let n = 0; n < 25_600; n++) {
      let id = '';
      for (let i = 0; i < 17; i++) {
        seed = (seed * 1103515245 + 12345) % 2 ** 31;
        id += alphabet[seed % alphabet.length];
      }
      const bucket = playerBucket(id);
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
    expect(counts.size).toBe(PLAYER_BUCKETS);
    expect(Math.max(...counts.values())).toBeLessThan(200);
    expect(Math.min(...counts.values())).toBeGreaterThan(40);
  });
});
