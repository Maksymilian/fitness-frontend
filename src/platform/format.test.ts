import { describe, expect, it } from 'vitest';
import { formatCalories, formatCount, formatDistance, formatDuration, formatMoney, formatUtcDay, humanize } from './format';

describe('format', () => {
  it.each([
    [45, '45 s'],
    [1925, '32 min 05 s'],
    [3725, '1 h 02 min'],
    [86_400, '24 h 00 min'],
  ])('formats a duration of %i seconds as %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it.each([
    [850, '850 m'],
    [12_345, '12.35 km'],
    [42_195, '42.20 km'],
  ])('formats a distance of %i meters as %s', (meters, expected) => {
    expect(formatDistance(meters)).toBe(expected);
  });

  it('formats calories and counts', () => {
    expect(formatCalories(1250)).toBe('1,250 kcal');
    expect(formatCount(1, 'active day', 'active days')).toBe('1 active day');
    expect(formatCount(4, 'active day', 'active days')).toBe('4 active days');
  });

  it('formats Billing’s exact amounts without turning them into floats', () => {
    expect(formatMoney('9.99', 'EUR')).toBe('€9.99');
    expect(formatMoney('99.90', 'PLN')).toBe('PLN 99.90');
    expect(formatMoney('99999999.99', 'GBP')).toBe('£99,999,999.99');
  });

  it('formats a UTC day the same in any time zone', () => {
    expect(formatUtcDay('2026-11-30T23:30:00.000Z')).toBe('30 Nov 2026');
  });

  it('turns the APIs’ constants into words', () => {
    expect(humanize('LONGEST_DISTANCE')).toBe('Longest distance');
    expect(humanize('WORKOUT_COUNT')).toBe('Workout count');
  });
});
