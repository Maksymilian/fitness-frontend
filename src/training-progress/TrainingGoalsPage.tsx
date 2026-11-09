import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';
import { useMember } from '../app/member-context';
import { formatDateTime, formatUtcDay, humanize } from '../platform/format';
import { ApiError } from '../platform/http';
import { Badge, Empty, ErrorNote, Field, Loading, Panel } from '../platform/ui';
import {
  abandonTrainingGoal,
  DISCIPLINES,
  type Discipline,
  GOAL_METRICS,
  GOAL_STATUSES,
  type GoalMetric,
  type GoalStatus,
  getTrainingGoals,
  setTrainingGoal,
  type TrainingGoal,
} from './api';
import { formatGoalAmount, GOAL_TARGET_UNITS, GRACE_PERIOD_MS, goalPeriodOf, goalTargetOf, lastDayOf, lastDayOfMonth, utcDayString } from './goal-units';

const STATUS_TONE: Record<GoalStatus, 'neutral' | 'good' | 'bad' | 'warn'> = {
  ACTIVE: 'neutral',
  ACHIEVED: 'good',
  MISSED: 'bad',
  ABANDONED: 'warn',
};

export function TrainingGoalsPage() {
  const { memberId } = useMember();
  const [status, setStatus] = useState<GoalStatus | null>(null);
  const goals = useQuery({
    queryKey: ['training-progress', 'training-goals', memberId, status],
    queryFn: () => getTrainingGoals(memberId, status),
  });

  return (
    <>
      <div className="page-heading">
        <h1>Training goals</h1>
      </div>
      <SetGoalForm memberId={memberId} />
      <Panel
        title="Goals"
        service="trainingProgress"
        actions={
          <label className="inline-field">
            Status
            <select value={status ?? ''} onChange={(event) => setStatus((event.target.value || null) as GoalStatus | null)}>
              <option value="">Any status</option>
              {GOAL_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
          </label>
        }
      >
        <ErrorNote error={goals.error} />
        {goals.isPending && <Loading what="training goals" />}
        {goals.data?.length === 0 && <Empty>No training goals{status ? ` with this status` : ''}.</Empty>}
        <ul className="goal-list">
          {goals.data?.map((goal) => (
            <GoalItem key={goal.id} goal={goal} memberId={memberId} />
          ))}
        </ul>
      </Panel>
    </>
  );
}

function SetGoalForm({ memberId }: { memberId: string }) {
  const queryClient = useQueryClient();
  const [metric, setMetric] = useState<GoalMetric>('DISTANCE');
  const [target, setTarget] = useState('');
  const [discipline, setDiscipline] = useState<Discipline | ''>('');
  // By default, from today to the end of the month (UTC days).
  const [firstDay, setFirstDay] = useState(() => utcDayString(new Date()));
  const [lastDay, setLastDay] = useState(() => utcDayString(lastDayOfMonth(new Date())));

  const set = useMutation({
    mutationFn: () =>
      setTrainingGoal({
        memberId,
        metric,
        target: goalTargetOf(metric, Number(target)),
        discipline: discipline || null,
        ...goalPeriodOf(firstDay, lastDay),
      }),
    onSuccess: async () => {
      setTarget('');
      await queryClient.invalidateQueries({ queryKey: ['training-progress', 'training-goals', memberId] });
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    set.mutate();
  };
  const unit = GOAL_TARGET_UNITS[metric];

  return (
    <Panel title="Set a goal" service="trainingProgress">
      <form className="form-grid" onSubmit={submit}>
        <Field label="Goal metric">
          <select value={metric} onChange={(event) => setMetric(event.target.value as GoalMetric)}>
            {GOAL_METRICS.map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Goal target (${unit.label})`}>
          <input
            type="number"
            required
            min={metric === 'WORKOUT_COUNT' || metric === 'CALORIES' ? 1 : 0.01}
            step={metric === 'WORKOUT_COUNT' || metric === 'CALORIES' ? 1 : 'any'}
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
        </Field>
        <Field label="Discipline">
          <select value={discipline} onChange={(event) => setDiscipline(event.target.value as Discipline | '')}>
            <option value="">Any discipline</option>
            {DISCIPLINES.map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="First day" hint="UTC days, like training periods">
          <input type="date" required value={firstDay} onChange={(event) => setFirstDay(event.target.value)} />
        </Field>
        <Field label="Last day" hint="Included">
          <input type="date" required min={firstDay} value={lastDay} onChange={(event) => setLastDay(event.target.value)} />
        </Field>
        <div className="form-actions">
          <button type="submit" className="primary" disabled={set.isPending}>
            {set.isPending ? 'Setting…' : 'Set goal'}
          </button>
        </div>
      </form>
      <ErrorNote error={set.error}>
        {set.error instanceof ApiError && set.error.code === 'GoalAllowanceReached' && (
          <p>
            Without a membership, a member holds one active goal at a time. <Link to="/membership">A membership</Link> lets them
            hold any number.
          </p>
        )}
      </ErrorNote>
    </Panel>
  );
}

function GoalItem({ goal, memberId }: { goal: TrainingGoal; memberId: string }) {
  const queryClient = useQueryClient();
  const abandon = useMutation({
    mutationFn: () => abandonTrainingGoal(memberId, goal.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['training-progress', 'training-goals', memberId] }),
  });
  const share = goal.target > 0 ? Math.min(goal.progress / goal.target, 1) : 0;
  const [openedAt] = useState(() => Date.now());
  // An active goal past its grace period is missed by Miss Ended Goals, on its daily schedule trigger.
  const awaitingMiss = goal.status === 'ACTIVE' && new Date(goal.endsOn).getTime() + GRACE_PERIOD_MS < openedAt;

  return (
    <li className="goal">
      <div className="goal-heading">
        <strong>
          {formatGoalAmount(goal.metric, goal.target)}
          {goal.discipline ? ` of ${humanize(goal.discipline).toLowerCase()}` : ''}
        </strong>
        <Badge tone={STATUS_TONE[goal.status]}>{humanize(goal.status)}</Badge>
      </div>
      <p className="muted small">
        {humanize(goal.metric)}, {formatUtcDay(goal.startsOn)} – {formatUtcDay(lastDayOf(goal.endsOn))}
        {goal.achievedAt && `, achieved ${formatDateTime(goal.achievedAt)}`}
      </p>
      {awaitingMiss && (
        <p className="muted small">
          Its goal period and grace period have ended: Miss Ended Goals marks it missed on its next daily schedule trigger.
        </p>
      )}
      <div className="goal-progress">
        <progress value={share} max={1} aria-label="Goal progress" />
        <span className="small">
          {formatGoalAmount(goal.metric, goal.progress)} of {formatGoalAmount(goal.metric, goal.target)} ({Math.floor(share * 100)}%)
        </span>
      </div>
      {goal.status === 'ACTIVE' && (
        <div className="row-actions">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Abandon this goal? An abandoned goal stays abandoned.')) {
                abandon.mutate();
              }
            }}
            disabled={abandon.isPending}
          >
            Abandon
          </button>
        </div>
      )}
      <ErrorNote error={abandon.error} />
    </li>
  );
}
