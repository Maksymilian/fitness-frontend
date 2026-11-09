import { Field } from '../platform/ui';
import type { TypedWorkoutMetrics } from './workout-metrics';

/** Duration, distance and calories; Workout Tracking checks the invariants (duration up to 24 hours). */
export function WorkoutMetricsFields({ value, onChange }: { value: TypedWorkoutMetrics; onChange(value: TypedWorkoutMetrics): void }) {
  return (
    <>
      <Field label="Duration (minutes)">
        <input
          type="number"
          required
          min={0.02}
          max={1440}
          step="any"
          value={value.minutes}
          onChange={(event) => onChange({ ...value, minutes: event.target.value })}
        />
      </Field>
      <Field label="Distance (km)">
        <input
          type="number"
          required
          min={0}
          step="any"
          value={value.kilometers}
          onChange={(event) => onChange({ ...value, kilometers: event.target.value })}
        />
      </Field>
      <Field label="Calories (kcal)">
        <input
          type="number"
          required
          min={0}
          step={1}
          value={value.calories}
          onChange={(event) => onChange({ ...value, calories: event.target.value })}
        />
      </Field>
    </>
  );
}
