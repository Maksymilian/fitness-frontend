import { describe, expect, it } from 'vitest';
import { formatGoalAmount, goalPeriodOf, goalTargetOf, lastDayOf, lastDayOfMonth, utcDayString } from './goal-units';

describe('goal units', () => {
  it('turns a typed goal target into the API’s units', () => {
    expect(goalTargetOf('DISTANCE', 200)).toBe(200_000);
    expect(goalTargetOf('DISTANCE', 12.3456)).toBe(12_346);
    expect(goalTargetOf('DURATION', 1.5)).toBe(5400);
    expect(goalTargetOf('CALORIES', 5000)).toBe(5000);
    expect(goalTargetOf('WORKOUT_COUNT', 12)).toBe(12);
  });

  it('formats a goal amount in its metric’s unit', () => {
    expect(formatGoalAmount('DISTANCE', 200_000)).toBe('200.00 km');
    expect(formatGoalAmount('DURATION', 36_000)).toBe('10 h 00 min');
    expect(formatGoalAmount('WORKOUT_COUNT', 1)).toBe('1 workout');
  });

  it('makes a goal period end at midnight UTC after its last day: the API’s end is exclusive', () => {
    expect(goalPeriodOf('2026-11-01', '2026-11-30')).toEqual({
      startsOn: '2026-11-01T00:00:00.000Z',
      endsOn: '2026-12-01T00:00:00.000Z',
    });
  });

  it('shows the last day a goal period includes', () => {
    expect(utcDayString(lastDayOf('2026-12-01T00:00:00.000Z'))).toBe('2026-11-30');
  });

  it('finds the last day of the month, leap years included', () => {
    expect(utcDayString(lastDayOfMonth(new Date('2028-02-10T12:00:00Z')))).toBe('2028-02-29');
    expect(utcDayString(lastDayOfMonth(new Date('2026-12-31T23:59:00Z')))).toBe('2026-12-31');
  });
});
