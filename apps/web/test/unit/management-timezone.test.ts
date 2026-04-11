import { describe, it, expect } from 'vitest';
import {
  combineDateAndTimeToUtc,
  formatDateInput,
  formatTimeInput,
} from '@/lib/management';

describe('management timezone helpers', () => {
  it('roundtrips date/time through combineDateAndTimeToUtc', () => {
    const date = '2026-04-07';
    const time = '14:30';
    const tz = 'America/Sao_Paulo';

    const result = combineDateAndTimeToUtc(date, time, tz);

    expect(formatDateInput(result, tz)).toBe(date);
    expect(formatTimeInput(result, tz)).toBe(time);
  });
});
