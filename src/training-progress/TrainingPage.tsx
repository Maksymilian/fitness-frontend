import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { useMember } from '../app/member-context';
import { formatCalories, formatCount, formatDateTime, formatDistance, formatDuration, formatUtcDay, humanize } from '../platform/format';
import { Empty, ErrorNote, Loading, Panel } from '../platform/ui';
import {
  DISCIPLINES,
  type Discipline,
  getMemberProgress,
  getTrainingLog,
  PERIOD_KINDS,
  type PeriodKind,
  type PersonalRecord,
  type ProgressSummary,
  type RecordMetric,
} from './api';

const RECORD_METRICS: readonly RecordMetric[] = ['LONGEST_DISTANCE', 'LONGEST_DURATION', 'MOST_CALORIES'];

function formatRecordValue(metric: RecordMetric, value: number): string {
  switch (metric) {
    case 'LONGEST_DISTANCE':
      return formatDistance(value);
    case 'LONGEST_DURATION':
      return formatDuration(value);
    case 'MOST_CALORIES':
      return formatCalories(value);
  }
}

export function TrainingPage() {
  const { memberId } = useMember();
  const [period, setPeriod] = useState<PeriodKind>('WEEK');
  // A moment inside the training period to show; null: today (UTC).
  const [date, setDate] = useState<string | null>(null);
  const [discipline, setDiscipline] = useState<Discipline | null>(null);

  const progress = useQuery({
    queryKey: ['training-progress', 'progress', memberId, period, date, discipline],
    queryFn: () => getMemberProgress(memberId, period, date, discipline),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <div className="page-heading">
        <h1>Training</h1>
        <div className="toolbar">
          <label className="inline-field">
            Discipline
            <select value={discipline ?? ''} onChange={(event) => setDiscipline((event.target.value || null) as Discipline | null)}>
              <option value="">All disciplines</option>
              {DISCIPLINES.map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <ErrorNote error={progress.error} />

      <Panel
        title="Progress summary"
        service="trainingProgress"
        actions={
          <div className="segmented" role="group" aria-label="Training period">
            {PERIOD_KINDS.map((kind) => (
              <button key={kind} type="button" aria-pressed={period === kind} onClick={() => setPeriod(kind)}>
                {humanize(kind)}
              </button>
            ))}
          </div>
        }
      >
        {progress.data ? (
          <>
            <PeriodNavigation summary={progress.data.progressSummary} onDate={setDate} isToday={date === null} />
            <div className="stats">
              <Stat label="Streak" value={formatCount(progress.data.streak, 'active day', 'active days')} hint="Consecutive days ending today or yesterday (UTC)" />
              <Stat label="Workouts" value={String(progress.data.progressSummary.workoutCount)} />
              <Stat label="Duration" value={formatDuration(progress.data.progressSummary.totalDurationSeconds)} />
              <Stat label="Distance" value={formatDistance(progress.data.progressSummary.totalDistanceMeters)} />
              <Stat label="Calories" value={formatCalories(progress.data.progressSummary.totalCalories)} />
            </div>
          </>
        ) : (
          progress.isPending && <Loading what="the progress summary" />
        )}
      </Panel>

      <Panel title="Personal records" service="trainingProgress">
        {progress.data && <PersonalRecords records={progress.data.personalRecords} />}
      </Panel>

      <TrainingLog memberId={memberId} discipline={discipline} />
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat" title={hint}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function PeriodNavigation({ summary, onDate, isToday }: { summary: ProgressSummary; onDate(date: string | null): void; isToday: boolean }) {
  const [openedAt] = useState(() => Date.now());
  const lastDay = new Date(new Date(summary.periodEnd).getTime() - 1);
  // No next period once this one contains the present: it would be empty.
  const containsNow = new Date(summary.periodEnd).getTime() > openedAt;
  return (
    <div className="period-nav">
      <button type="button" onClick={() => onDate(new Date(new Date(summary.periodStart).getTime() - 1).toISOString())} aria-label="Previous period">
        ‹
      </button>
      <span>
        {formatUtcDay(summary.periodStart)} – {formatUtcDay(lastDay)} <span className="muted">(UTC)</span>
      </span>
      <button type="button" onClick={() => onDate(summary.periodEnd)} disabled={containsNow} aria-label="Next period">
        ›
      </button>
      {!isToday && (
        <button type="button" className="link-button" onClick={() => onDate(null)}>
          Back to today
        </button>
      )}
    </div>
  );
}

function PersonalRecords({ records }: { records: PersonalRecord[] }) {
  if (records.length === 0) {
    return <Empty>No personal records yet: they're set by counting workouts.</Empty>;
  }
  const disciplines = DISCIPLINES.filter((discipline) => records.some((record) => record.discipline === discipline));
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">Discipline</th>
            {RECORD_METRICS.map((metric) => (
              <th key={metric} scope="col">
                {humanize(metric)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {disciplines.map((discipline) => (
            <tr key={discipline}>
              <th scope="row">{humanize(discipline)}</th>
              {RECORD_METRICS.map((metric) => {
                const record = records.find((candidate) => candidate.discipline === discipline && candidate.metric === metric);
                return (
                  <td key={metric}>
                    {record ? (
                      <>
                        <strong>{formatRecordValue(metric, record.value)}</strong>
                        <span className="cell-hint">{formatDateTime(record.setAt)}</span>
                      </>
                    ) : (
                      '–'
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrainingLog({ memberId, discipline }: { memberId: string; discipline: Discipline | null }) {
  const log = useInfiniteQuery({
    queryKey: ['training-progress', 'training-log', memberId, discipline],
    queryFn: ({ pageParam }) => getTrainingLog(memberId, pageParam, discipline),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => (page.pageInfo.hasNextPage ? page.pageInfo.endCursor : undefined),
  });
  const workouts = log.data?.pages.flatMap((page) => page.edges.map((edge) => edge.node)) ?? [];

  return (
    <Panel
      title="Training log"
      service="trainingProgress"
      actions={
        <button type="button" onClick={() => void log.refetch()} disabled={log.isFetching}>
          {log.isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    >
      <p className="muted small">
        Counting workouts, newest first. A workout recorded in Workout Tracking arrives here as an event, a moment later.
      </p>
      <ErrorNote error={log.error} />
      {log.isPending && <Loading what="the training log" />}
      {log.isSuccess && workouts.length === 0 && (
        <Empty>
          No workouts logged yet. <Link to="/equipment">Record one on paired equipment</Link>.
        </Empty>
      )}
      {workouts.length > 0 && (
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
              </tr>
            </thead>
            <tbody>
              {workouts.map((workout) => (
                <tr key={workout.id}>
                  <td>{formatDateTime(workout.startedAt)}</td>
                  <td>{humanize(workout.discipline)}</td>
                  <td className="numeric">{formatDuration(workout.durationSeconds)}</td>
                  <td className="numeric">{formatDistance(workout.distanceMeters)}</td>
                  <td className="numeric">{formatCalories(workout.calories)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {log.hasNextPage && (
        <button type="button" className="load-more" onClick={() => void log.fetchNextPage()} disabled={log.isFetchingNextPage}>
          {log.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}
    </Panel>
  );
}
