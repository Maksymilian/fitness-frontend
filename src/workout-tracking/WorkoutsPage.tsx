import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, Fragment, useState } from 'react';
import { Link } from 'react-router';
import { useMember } from '../app/member-context';
import { formatCalories, formatDateTime, formatDistance, formatDuration, humanize } from '../platform/format';
import { Badge, Empty, ErrorNote, Field, Loading, Note, Panel } from '../platform/ui';
import { correctWorkout, memberWorkouts, voidWorkout, type Workout } from './api';
import { type TypedWorkoutMetrics, typedWorkoutMetricsOf, workoutMetricsOf } from './workout-metrics';
import { WorkoutMetricsFields } from './WorkoutMetricsFields';

type Action = { workoutId: string; kind: 'correction' | 'void' };

export function WorkoutsPage() {
  const { memberId } = useMember();
  const [action, setAction] = useState<Action | null>(null);
  const workouts = useInfiniteQuery({
    queryKey: ['workout-tracking', 'workouts', memberId],
    queryFn: ({ pageParam }) => memberWorkouts(memberId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const all = workouts.data?.pages.flatMap((page) => page.workouts) ?? [];

  return (
    <>
      <div className="page-heading">
        <h1>Workouts</h1>
      </div>
      <Note tone="warning">
        Back office: corrections and voids go to Workout Tracking, which publishes them; Training Progress revises the logged workout,
        or stops counting it, when the event arrives.
      </Note>
      <Panel
        title={`Workouts of ${memberId}`}
        service="workoutTracking"
        actions={
          <button type="button" onClick={() => void workouts.refetch()} disabled={workouts.isFetching}>
            {workouts.isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        }
      >
        <p className="muted small">Newest first, voided ones included.</p>
        <ErrorNote error={workouts.error} />
        {workouts.isPending && <Loading what="workouts" />}
        {workouts.isSuccess && all.length === 0 && (
          <Empty>
            No workouts recorded for this member. <Link to="/equipment">Record one on paired equipment</Link>.
          </Empty>
        )}
        {all.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Started at</th>
                  <th scope="col">Discipline</th>
                  <th scope="col" className="numeric">
                    Duration
                  </th>
                  <th scope="col" className="numeric">
                    Distance
                  </th>
                  <th scope="col" className="numeric">
                    Calories
                  </th>
                  <th scope="col">Workout status</th>
                  <th scope="col" className="numeric">
                    Revision
                  </th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {all.map((workout) => (
                  <Fragment key={workout.id}>
                    <tr className={workout.status === 'VOIDED' ? 'voided' : undefined}>
                      <td>{formatDateTime(workout.startedAt)}</td>
                      <td>
                        {humanize(workout.discipline)}
                        <span className="cell-hint">{humanize(workout.equipmentType)}</span>
                      </td>
                      <td className="numeric">{formatDuration(workout.durationSeconds)}</td>
                      <td className="numeric">{formatDistance(workout.distanceMeters)}</td>
                      <td className="numeric">{formatCalories(workout.calories)}</td>
                      <td>
                        <Badge tone={workout.status === 'RECORDED' ? 'good' : 'bad'}>{humanize(workout.status)}</Badge>
                        {workout.voidReason && <span className="cell-hint">{workout.voidReason}</span>}
                      </td>
                      <td className="numeric">{workout.revision}</td>
                      <td className="actions-cell">
                        {workout.status === 'RECORDED' && (
                          <div className="cell-actions">
                            <button
                              type="button"
                              aria-expanded={action?.workoutId === workout.id && action.kind === 'correction'}
                              onClick={() => setAction(toggle(action, { workoutId: workout.id, kind: 'correction' }))}
                            >
                              Correct
                            </button>
                            <button
                              type="button"
                              aria-expanded={action?.workoutId === workout.id && action.kind === 'void'}
                              onClick={() => setAction(toggle(action, { workoutId: workout.id, kind: 'void' }))}
                            >
                              Void
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {action?.workoutId === workout.id && (
                      <tr className="expanded">
                        <td colSpan={8}>
                          {action.kind === 'correction' ? (
                            <CorrectionForm workout={workout} onDone={() => setAction(null)} />
                          ) : (
                            <VoidForm workout={workout} onDone={() => setAction(null)} />
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {workouts.hasNextPage && (
          <button type="button" className="load-more" onClick={() => void workouts.fetchNextPage()} disabled={workouts.isFetchingNextPage}>
            {workouts.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        )}
      </Panel>
    </>
  );
}

function toggle(current: Action | null, next: Action): Action | null {
  return current?.workoutId === next.workoutId && current.kind === next.kind ? null : next;
}

/** After a correction or a void: Workout Tracking's list, and Training Progress' views of the member. */
function useAfterChange(workout: Workout, onDone: () => void) {
  const queryClient = useQueryClient();
  return async () => {
    onDone();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['workout-tracking', 'workouts', workout.memberId] }),
      queryClient.invalidateQueries({ queryKey: ['training-progress'] }),
    ]);
  };
}

function CorrectionForm({ workout, onDone }: { workout: Workout; onDone(): void }) {
  const [metrics, setMetrics] = useState<TypedWorkoutMetrics>(() => typedWorkoutMetricsOf(workout));
  const [reason, setReason] = useState('');
  const correct = useMutation({
    mutationFn: () => correctWorkout(workout.id, workoutMetricsOf(metrics), reason.trim()),
    onSuccess: useAfterChange(workout, onDone),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    correct.mutate();
  };
  return (
    <form className="subform" onSubmit={submit}>
      <h3>Correction</h3>
      <div className="form-grid">
        <WorkoutMetricsFields value={metrics} onChange={setMetrics} />
        <Field label="Correction reason">
          <input required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </div>
      <div className="form-actions">
        <button type="submit" className="primary" disabled={correct.isPending}>
          Correct workout
        </button>
        <button type="button" onClick={onDone}>
          Close
        </button>
      </div>
      <ErrorNote error={correct.error} />
    </form>
  );
}

function VoidForm({ workout, onDone }: { workout: Workout; onDone(): void }) {
  const [reason, setReason] = useState('');
  const voidIt = useMutation({
    mutationFn: () => voidWorkout(workout.id, reason.trim()),
    onSuccess: useAfterChange(workout, onDone),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    voidIt.mutate();
  };
  return (
    <form className="subform" onSubmit={submit}>
      <h3>Void</h3>
      <p className="muted small">A voided workout is kept, stops counting everywhere, and can't be corrected or voided again.</p>
      <div className="form-grid">
        <Field label="Void reason">
          <input required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Someone else used the equipment" />
        </Field>
      </div>
      <div className="form-actions">
        <button type="submit" className="danger" disabled={voidIt.isPending}>
          Void workout
        </button>
        <button type="button" onClick={onDone}>
          Close
        </button>
      </div>
      <ErrorNote error={voidIt.error} />
    </form>
  );
}
