import { describe, expect, it } from 'bun:test';
import { reportProblemUrl } from './paths';

describe('reportProblemUrl', () => {
  it('opens the issues with nothing to fill in', () => {
    expect(reportProblemUrl()).toBe('https://github.com/zmnatz/usa-club-rugby-eligibility/issues');
  });
});
