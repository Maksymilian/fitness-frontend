import { formatCalories, formatCount, formatDistance, formatDuration } from '../platform/format';
import type { GoalMetric } from './api';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A goal stays active one day after its goal period ends, so late-logged workouts still count. */
export const GRACE_PERIOD_MS = DAY_MS;

/**
 * The unit a member types a goal target in, and how many of the API's units (meters, seconds,
 * kilocalories, workouts) one of it is.
 */
export const GOAL_TARGET_UNITS: Readonly<Record<GoalMetric, { label: string; perUnit: number }>> = {
  DISTANCE: { label: 'km', perUnit: 1000 },
  DURATION: { label: 'hours', perUnit: 3600 },
  CALORIES: { label: 'kcal', perUnit: 1 },
  WORKOUT_COUNT: { label: 'workouts', perUnit: 1 },
};

/** A goal target as the API takes it: a whole number of meters, seconds, kilocalories or workouts. */
export function goalTargetOf(metric: GoalMetric, typed: number): number {
  return Math.round(typed * GOAL_TARGET_UNITS[metric].perUnit);
}

/** A goal metric's amount (target or progress), for display. */
export function formatGoalAmount(metric: GoalMetric, amount: number): string {
  switch (metric) {
    case 'DISTANCE':
      return formatDistance(amount);
    case 'DURATION':
      return formatDuration(amount);
    case 'CALORIES':
      return formatCalories(amount);
    case 'WORKOUT_COUNT':
      return formatCount(amount, 'workout', 'workouts');
  }
}

/**
 * A goal period from the first and last UTC days a member picks (`YYYY-MM-DD`), both included, as
 * the API takes it: `[startsOn, endsOn)`, so `endsOn` is midnight UTC after the last day.
 */
export function goalPeriodOf(firstDay: string, lastDay: string): { startsOn: string; endsOn: string } {
  const startsOn = new Date(`${firstDay}T00:00:00.000Z`);
  const endsOn = new Date(new Date(`${lastDay}T00:00:00.000Z`).getTime() + DAY_MS);
  return { startsOn: startsOn.toISOString(), endsOn: endsOn.toISOString() };
}

/** The last day a goal period includes: the day before its exclusive end. */
export function lastDayOf(endsOn: string): Date {
  return new Date(new Date(endsOn).getTime() - DAY_MS);
}

/** `YYYY-MM-DD` of a UTC day. */
export function utcDayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The last UTC day of the month that contains `date`. */
export function lastDayOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}
