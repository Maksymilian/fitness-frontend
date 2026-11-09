import type { WorkoutMetrics } from './api';

/** Workout metrics as typed in a form: minutes, kilometers and kilocalories. */
export interface TypedWorkoutMetrics {
  minutes: string;
  kilometers: string;
  calories: string;
}

/** As Workout Tracking takes them: whole seconds, meters and kilocalories. */
export function workoutMetricsOf({ minutes, kilometers, calories }: TypedWorkoutMetrics): WorkoutMetrics {
  return {
    durationSeconds: Math.round(Number(minutes) * 60),
    distanceMeters: Math.round(Number(kilometers) * 1000),
    calories: Math.round(Number(calories)),
  };
}

export function typedWorkoutMetricsOf({ durationSeconds, distanceMeters, calories }: WorkoutMetrics): TypedWorkoutMetrics {
  return {
    minutes: String(Number((durationSeconds / 60).toFixed(2))),
    kilometers: String(Number((distanceMeters / 1000).toFixed(3))),
    calories: String(calories),
  };
}

/** A `datetime-local` input's value for a moment, in the browser's time zone. */
export function localDateTimeInput(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
