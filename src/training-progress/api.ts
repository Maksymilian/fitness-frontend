import { graphqlClient } from '../platform/graphql';
import { SERVICES } from '../platform/services';

/**
 * Training Progress' GraphQL API (fitness-backend's `docs/architecture.md`, 6.4): the member's training log,
 * progress summaries, streak, personal records and training goals. Until Identity exists, the
 * member is chosen with `member(id:)`.
 */
const request = graphqlClient(SERVICES.trainingProgress.name, `${SERVICES.trainingProgress.url}/graphql`);

export type Discipline = 'CYCLING' | 'RUNNING' | 'WALKING' | 'ROWING';
export type PeriodKind = 'WEEK' | 'MONTH' | 'YEAR';
export type RecordMetric = 'LONGEST_DISTANCE' | 'LONGEST_DURATION' | 'MOST_CALORIES';
export type GoalMetric = 'DISTANCE' | 'DURATION' | 'CALORIES' | 'WORKOUT_COUNT';
export type GoalStatus = 'ACTIVE' | 'ACHIEVED' | 'MISSED' | 'ABANDONED';

export const DISCIPLINES: readonly Discipline[] = ['CYCLING', 'RUNNING', 'WALKING', 'ROWING'];
export const PERIOD_KINDS: readonly PeriodKind[] = ['WEEK', 'MONTH', 'YEAR'];
export const GOAL_METRICS: readonly GoalMetric[] = ['DISTANCE', 'DURATION', 'CALORIES', 'WORKOUT_COUNT'];
export const GOAL_STATUSES: readonly GoalStatus[] = ['ACTIVE', 'ACHIEVED', 'MISSED', 'ABANDONED'];

export interface LoggedWorkout {
  id: string;
  discipline: Discipline;
  startedAt: string;
  durationSeconds: number;
  distanceMeters: number;
  calories: number;
}

export interface ProgressSummary {
  period: PeriodKind;
  /** `[periodStart, periodEnd)`, UTC. */
  periodStart: string;
  periodEnd: string;
  discipline: Discipline | null;
  workoutCount: number;
  totalDurationSeconds: number;
  totalDistanceMeters: number;
  totalCalories: number;
}

export interface PersonalRecord {
  discipline: Discipline;
  metric: RecordMetric;
  /** Meters, seconds or kilocalories, depending on the record metric. */
  value: number;
  setAt: string;
  loggedWorkout: Pick<LoggedWorkout, 'id' | 'startedAt'>;
}

export interface TrainingGoal {
  id: string;
  metric: GoalMetric;
  /** Meters, seconds, kilocalories or workouts, depending on the goal metric. */
  target: number;
  discipline: Discipline | null;
  startsOn: string;
  /** Exclusive: workouts that started before this moment count. */
  endsOn: string;
  status: GoalStatus;
  progress: number;
  achievedAt: string | null;
}

export interface TrainingLogPage {
  edges: { cursor: string; node: LoggedWorkout }[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

export interface MemberProgress {
  streak: number;
  progressSummary: ProgressSummary;
  personalRecords: PersonalRecord[];
}

const LOGGED_WORKOUT = 'id discipline startedAt durationSeconds distanceMeters calories';
const TRAINING_GOAL = 'id metric target discipline startsOn endsOn status progress achievedAt';

export async function getMemberProgress(
  memberId: string,
  period: PeriodKind,
  date: string | null,
  discipline: Discipline | null,
): Promise<MemberProgress> {
  const data = await request<{ member: MemberProgress }>(
    `query MemberProgress($memberId: ID!, $period: PeriodKind!, $date: DateTime, $discipline: Discipline) {
      member(id: $memberId) {
        streak
        progressSummary(period: $period, date: $date, discipline: $discipline) {
          period periodStart periodEnd discipline workoutCount totalDurationSeconds totalDistanceMeters totalCalories
        }
        personalRecords(discipline: $discipline) {
          discipline metric value setAt loggedWorkout { id startedAt }
        }
      }
    }`,
    { memberId, period, date, discipline },
  );
  return data.member;
}

/** Counting workouts only, newest first. */
export async function getTrainingLog(memberId: string, after: string | null, discipline: Discipline | null, first = 20): Promise<TrainingLogPage> {
  const data = await request<{ member: { trainingLog: TrainingLogPage } }>(
    `query TrainingLog($memberId: ID!, $first: Int!, $after: String, $discipline: Discipline) {
      member(id: $memberId) {
        trainingLog(first: $first, after: $after, discipline: $discipline) {
          edges { cursor node { ${LOGGED_WORKOUT} } }
          pageInfo { hasNextPage endCursor }
        }
      }
    }`,
    { memberId, first, after, discipline },
  );
  return data.member.trainingLog;
}

export async function getTrainingGoals(memberId: string, status: GoalStatus | null): Promise<TrainingGoal[]> {
  const data = await request<{ member: { trainingGoals: TrainingGoal[] } }>(
    `query TrainingGoals($memberId: ID!, $status: GoalStatus) {
      member(id: $memberId) { trainingGoals(status: $status) { ${TRAINING_GOAL} } }
    }`,
    { memberId, status },
  );
  return data.member.trainingGoals;
}

export interface SetTrainingGoal {
  memberId: string;
  metric: GoalMetric;
  target: number;
  discipline: Discipline | null;
  startsOn: string;
  endsOn: string;
}

export async function setTrainingGoal(input: SetTrainingGoal): Promise<TrainingGoal> {
  const data = await request<{ setTrainingGoal: TrainingGoal }>(
    `mutation SetTrainingGoal($input: SetTrainingGoalInput!) { setTrainingGoal(input: $input) { ${TRAINING_GOAL} } }`,
    { input: { ...input, discipline: input.discipline ?? undefined } },
  );
  return data.setTrainingGoal;
}

export async function abandonTrainingGoal(memberId: string, trainingGoalId: string): Promise<TrainingGoal> {
  const data = await request<{ abandonTrainingGoal: TrainingGoal }>(
    `mutation AbandonTrainingGoal($input: AbandonTrainingGoalInput!) { abandonTrainingGoal(input: $input) { ${TRAINING_GOAL} } }`,
    { input: { memberId, trainingGoalId } },
  );
  return data.abandonTrainingGoal;
}
