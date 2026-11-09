import { describe, expect, it } from 'vitest';
import { typedWorkoutMetricsOf, workoutMetricsOf } from './workout-metrics';

describe('workout metrics', () => {
  it('turns minutes, kilometers and kilocalories into whole seconds, meters and kilocalories', () => {
    expect(workoutMetricsOf({ minutes: '30.5', kilometers: '12.3456', calories: '410.6' })).toEqual({
      durationSeconds: 1830,
      distanceMeters: 12_346,
      calories: 411,
    });
  });

  it('fills a correction form with the workout’s metrics', () => {
    const typed = typedWorkoutMetricsOf({ durationSeconds: 1830, distanceMeters: 12_346, calories: 411 });

    expect(typed).toEqual({ minutes: '30.5', kilometers: '12.346', calories: '411' });
    expect(workoutMetricsOf(typed)).toEqual({ durationSeconds: 1830, distanceMeters: 12_346, calories: 411 });
  });
});
