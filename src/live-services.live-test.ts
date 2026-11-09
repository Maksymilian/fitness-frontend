import { describe, expect, it } from 'vitest';
import { getLedger, getMembership } from './billing/api';
import { ApiError } from './platform/http';
import { abandonTrainingGoal, getMemberProgress, getTrainingGoals, getTrainingLog, setTrainingGoal, type TrainingLogPage } from './training-progress/api';
import { goalPeriodOf, lastDayOfMonth, utcDayString } from './training-progress/goal-units';
import { correctWorkout, memberWorkouts, pairEquipment, recordWorkout, registerEquipment, unpairEquipment, voidWorkout } from './workout-tracking/api';

/**
 * `pnpm test:live`: the app's API calls against the running services, through the dev server's
 * proxy (`pnpm dev`), as the browser makes them. Writes to the local databases, for a new member
 * each run, so the test records stay as they are.
 */
const member = `web-live-${Date.now()}@example.com`;

/** Training Progress logs a workout when Workout Tracking's event arrives: eventually. */
async function eventually<T>(read: () => Promise<T>, until: (value: T) => boolean, timeoutMs = 15_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (until(value) || Date.now() > deadline) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

const loggedWorkouts = (page: TrainingLogPage) => page.edges.map((edge) => edge.node);

describe(`the app against the running services, for ${member}`, { timeout: 60_000 }, () => {
  it('records, corrects and voids a workout in Workout Tracking, and Training Progress follows', async () => {
    const treadmill = await registerEquipment(`WEB-LIVE-${Date.now()}`, 'TREADMILL');
    expect(treadmill.pairedMemberId).toBeNull();
    expect((await pairEquipment(treadmill.id, member)).pairedMemberId).toBe(member);

    const recording = {
      recordingId: `web-live-${crypto.randomUUID()}`,
      discipline: 'RUNNING' as const,
      startedAt: new Date(Date.now() - 60 * 60_000).toISOString(),
      durationSeconds: 1800,
      distanceMeters: 5000,
      calories: 300,
    };
    const recorded = await recordWorkout(treadmill.id, recording);
    expect(recorded.duplicate).toBe(false);
    const again = await recordWorkout(treadmill.id, recording);
    expect(again).toEqual({ workout: recorded.workout, duplicate: true });
    expect((await memberWorkouts(member, null)).workouts.map((workout) => workout.id)).toEqual([recorded.workout.id]);

    const logged = await eventually(
      () => getTrainingLog(member, null, null),
      (page) => page.edges.length > 0,
    );
    expect(loggedWorkouts(logged)).toEqual([
      { id: recorded.workout.id, discipline: 'RUNNING', startedAt: recording.startedAt, durationSeconds: 1800, distanceMeters: 5000, calories: 300 },
    ]);

    const progress = await eventually(
      () => getMemberProgress(member, 'WEEK', null, null),
      (value) => value.personalRecords.length > 0,
    );
    expect(progress.streak).toBe(1);
    expect(progress.progressSummary).toMatchObject({ period: 'WEEK', workoutCount: 1, totalDistanceMeters: 5000 });
    expect(progress.personalRecords).toContainEqual(expect.objectContaining({ discipline: 'RUNNING', metric: 'LONGEST_DISTANCE', value: 5000 }));

    const corrected = await correctWorkout(recorded.workout.id, { durationSeconds: 1800, distanceMeters: 6000, calories: 320 }, 'Treadmill belt calibrated');
    expect(corrected.revision).toBe(2);
    const revised = await eventually(
      () => getTrainingLog(member, null, null),
      (page) => loggedWorkouts(page)[0]?.distanceMeters === 6000,
    );
    expect(loggedWorkouts(revised)[0]?.distanceMeters).toBe(6000);

    const voided = await voidWorkout(recorded.workout.id, 'Someone else used the treadmill');
    expect(voided).toMatchObject({ status: 'VOIDED', revision: 3, voidReason: 'Someone else used the treadmill' });
    const stoppedCounting = await eventually(
      () => getTrainingLog(member, null, null),
      (page) => page.edges.length === 0,
    );
    expect(stoppedCounting.edges).toEqual([]);

    await unpairEquipment(treadmill.id);
  });

  it('sets training goals up to the goal allowance of a member without a membership, and abandons one', async () => {
    expect(await getMembership(member)).toBeNull();
    expect(await getLedger(member, null)).toEqual({ entries: [], nextCursor: null });

    const period = goalPeriodOf(utcDayString(new Date()), utcDayString(lastDayOfMonth(new Date())));
    const goal = await setTrainingGoal({ memberId: member, metric: 'DISTANCE', target: 50_000, discipline: 'RUNNING', ...period });
    expect(goal).toMatchObject({ status: 'ACTIVE', target: 50_000, discipline: 'RUNNING', progress: 0 });

    const second = await setTrainingGoal({ memberId: member, metric: 'WORKOUT_COUNT', target: 5, discipline: null, ...period }).catch(
      (error: unknown) => error,
    );
    expect(second).toBeInstanceOf(ApiError);
    expect(second).toMatchObject({ code: 'GoalAllowanceReached' });

    expect((await abandonTrainingGoal(member, goal.id)).status).toBe('ABANDONED');
    expect((await getTrainingGoals(member, 'ABANDONED')).map(({ id }) => id)).toEqual([goal.id]);
  });

  it('reads a membership and its ledger from Billing', async () => {
    const membership = await getMembership('ada@example.com');
    expect(membership).toMatchObject({ memberId: 'ada@example.com', plan: 'MONTHLY' });
    const ledger = await getLedger('ada@example.com', null);
    expect(ledger.entries[0]).toMatchObject({ kind: 'PAYMENT', amount: expect.stringMatching(/^\d+\.\d{2}$/) });
  });
});
