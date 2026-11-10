import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { EligibilityStatusChip } from './EligibilityStatusChip';

const chip = (eligible: boolean, pending: string[], cautions: string[]) =>
  renderToStaticMarkup(<EligibilityStatusChip player={{ eligible, pending, cautions }} />);

describe('EligibilityStatusChip', () => {
  it('shows a cautioned player as CAUTION', () => {
    const html = chip(true, [], ['One more D1 match (3 played) loses D3 eligibility for the rest of the season']);

    expect(html).toContain('CAUTION');
    expect(html).toContain('ec-chip--warning');
  });

  it('ranks Caution above On Track, which a player can still recover from', () => {
    expect(chip(true, ['Needs 1 more D3 match (1 fixture left)'], ['One more upper-side match'])).toContain('CAUTION');
  });

  it('ranks Ineligible above Caution', () => {
    expect(chip(false, [], ['One more upper-side match'])).toContain('INELIGIBLE');
  });

  it('leaves the other statuses as they were', () => {
    expect(chip(false, [], [])).toContain('INELIGIBLE');
    expect(chip(true, ['Needs 1 more D3 match (1 fixture left)'], [])).toContain('ON TRACK');
    expect(chip(true, [], [])).toContain('>ELIGIBLE<');
  });
});
