import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';
import { useMember } from '../app/member-context';
import { formatDateTime, humanize } from '../platform/format';
import { ApiError } from '../platform/http';
import { Badge, Empty, ErrorNote, Field, Loading, Note, Panel } from '../platform/ui';
import {
  type Discipline,
  EQUIPMENT_TYPES,
  type Equipment,
  type EquipmentType,
  getEquipment,
  pairEquipment,
  type Recording,
  recordWorkout,
  registerEquipment,
  SUPPORTED_DISCIPLINES,
  unpairEquipment,
  type Workout,
} from './api';
import { useKnownEquipment } from './known-equipment';
import { localDateTimeInput, type TypedWorkoutMetrics, workoutMetricsOf } from './workout-metrics';
import { WorkoutMetricsFields } from './WorkoutMetricsFields';

export function EquipmentPage() {
  const { ids, remember, forget } = useKnownEquipment();
  return (
    <>
      <div className="page-heading">
        <h1>Equipment</h1>
      </div>
      <Note tone="warning">
        Back office: Workout Tracking's internal API, which connected equipment and back-office tools call. In production it stays
        off the public internet.
      </Note>
      <div className="columns">
        <RegisterEquipmentForm onRegistered={remember} />
        <FindEquipmentForm onFound={remember} />
      </div>
      <Panel title="Known equipment" service="workoutTracking">
        <p className="muted small">The equipment registered or looked up in this browser, and the equipment in the test records.</p>
        {ids.length === 0 && <Empty>None yet: register equipment, or look it up by id.</Empty>}
        <ul className="card-list">
          {ids.map((id) => (
            <EquipmentCard key={id} equipmentId={id} onForget={() => forget(id)} />
          ))}
        </ul>
      </Panel>
    </>
  );
}

function RegisterEquipmentForm({ onRegistered }: { onRegistered(id: string): void }) {
  const queryClient = useQueryClient();
  const [serialNumber, setSerialNumber] = useState('');
  const [type, setType] = useState<EquipmentType>('BIKE');
  const register = useMutation({
    mutationFn: () => registerEquipment(serialNumber.trim(), type),
    onSuccess: (equipment) => {
      queryClient.setQueryData(['workout-tracking', 'equipment', equipment.id], equipment);
      onRegistered(equipment.id);
      setSerialNumber('');
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    register.mutate();
  };
  return (
    <Panel title="Register equipment" service="workoutTracking">
      <form className="form-grid" onSubmit={submit}>
        <Field label="Serial number">
          <input required maxLength={64} value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} placeholder="BK-0042" />
        </Field>
        <Field label="Equipment type">
          <select value={type} onChange={(event) => setType(event.target.value as EquipmentType)}>
            {EQUIPMENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-actions">
          <button type="submit" className="primary" disabled={register.isPending}>
            Register
          </button>
        </div>
      </form>
      <ErrorNote error={register.error} />
    </Panel>
  );
}

function FindEquipmentForm({ onFound }: { onFound(id: string): void }) {
  const queryClient = useQueryClient();
  const [equipmentId, setEquipmentId] = useState('');
  const find = useMutation({
    mutationFn: () => getEquipment(equipmentId.trim()),
    onSuccess: (equipment) => {
      queryClient.setQueryData(['workout-tracking', 'equipment', equipment.id], equipment);
      onFound(equipment.id);
      setEquipmentId('');
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    find.mutate();
  };
  return (
    <Panel title="Look up equipment" service="workoutTracking">
      <form className="form-grid" onSubmit={submit}>
        <Field label="Equipment id">
          <input required value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)} placeholder="0199c3a2-…" />
        </Field>
        <div className="form-actions">
          <button type="submit" disabled={find.isPending}>
            Look up
          </button>
        </div>
      </form>
      <ErrorNote error={find.error} />
    </Panel>
  );
}

function EquipmentCard({ equipmentId, onForget }: { equipmentId: string; onForget(): void }) {
  const equipment = useQuery({
    queryKey: ['workout-tracking', 'equipment', equipmentId],
    queryFn: () => getEquipment(equipmentId),
  });
  const notFound = equipment.error instanceof ApiError && equipment.error.status === 404;

  return (
    <li className="card">
      <div className="card-heading">
        {equipment.data ? (
          <>
            <strong>{equipment.data.serialNumber}</strong>
            <Badge tone="neutral">{humanize(equipment.data.type)}</Badge>
            {equipment.data.pairedMemberId ? <Badge tone="good">Paired</Badge> : <Badge tone="warn">Not paired</Badge>}
          </>
        ) : (
          <code>{equipmentId}</code>
        )}
        <button type="button" className="link-button push-right" onClick={onForget}>
          Forget
        </button>
      </div>
      {equipment.isPending && <Loading what="the equipment" />}
      {notFound ? <p className="muted small">Workout Tracking has no equipment with this id.</p> : <ErrorNote error={equipment.error} />}
      {equipment.data && <EquipmentDetails equipment={equipment.data} />}
    </li>
  );
}

function EquipmentDetails({ equipment }: { equipment: Equipment }) {
  const queryClient = useQueryClient();
  const { memberId } = useMember();
  const [pairWith, setPairWith] = useState(memberId);
  const [recording, setRecording] = useState(false);
  const key = ['workout-tracking', 'equipment', equipment.id];

  const pair = useMutation({
    mutationFn: () => pairEquipment(equipment.id, pairWith.trim().toLowerCase()),
    onSuccess: (paired) => queryClient.setQueryData(key, paired),
  });
  const unpair = useMutation({
    mutationFn: () => unpairEquipment(equipment.id),
    onSuccess: () => {
      setRecording(false);
      return queryClient.invalidateQueries({ queryKey: key });
    },
  });

  return (
    <>
      <dl className="details compact">
        <div>
          <dt>Equipment id</dt>
          <dd>
            <code>{equipment.id}</code>
          </dd>
        </div>
        <div>
          <dt>Registered</dt>
          <dd>{formatDateTime(equipment.registeredAt)}</dd>
        </div>
        <div>
          <dt>Paired member</dt>
          <dd>{equipment.pairedMemberId ? `${equipment.pairedMemberId} (since ${formatDateTime(equipment.pairedAt ?? equipment.registeredAt)})` : '–'}</dd>
        </div>
        <div>
          <dt>Supported disciplines</dt>
          <dd>{SUPPORTED_DISCIPLINES[equipment.type].map(humanize).join(', ')}</dd>
        </div>
      </dl>

      {equipment.pairedMemberId ? (
        <div className="row-actions">
          <button type="button" className="primary" onClick={() => setRecording((open) => !open)} aria-expanded={recording}>
            Record a workout
          </button>
          <button type="button" onClick={() => unpair.mutate()} disabled={unpair.isPending}>
            Unpair
          </button>
        </div>
      ) : (
        <form
          className="row-actions"
          onSubmit={(event) => {
            event.preventDefault();
            pair.mutate();
          }}
        >
          <label className="inline-field">
            Pair with
            <input type="email" required value={pairWith} onChange={(event) => setPairWith(event.target.value)} />
          </label>
          <button type="submit" disabled={pair.isPending}>
            Pair
          </button>
        </form>
      )}
      <ErrorNote error={pair.error ?? unpair.error} />
      {recording && equipment.pairedMemberId && <RecordingForm equipment={equipment} pairedMemberId={equipment.pairedMemberId} />}
    </>
  );
}

function newRecordingId(): string {
  return `web-${crypto.randomUUID()}`;
}

function RecordingForm({ equipment, pairedMemberId }: { equipment: Equipment; pairedMemberId: string }) {
  const queryClient = useQueryClient();
  const supported = SUPPORTED_DISCIPLINES[equipment.type];
  const [recordingId, setRecordingId] = useState(newRecordingId);
  const [discipline, setDiscipline] = useState<Discipline>(supported[0] ?? 'CYCLING');
  const [startedAt, setStartedAt] = useState(() => localDateTimeInput(new Date(Date.now() - 45 * 60_000)));
  const [metrics, setMetrics] = useState<TypedWorkoutMetrics>({ minutes: '30', kilometers: '5', calories: '250' });
  const [last, setLast] = useState<{ recording: Recording; workout: Workout; duplicate: boolean } | null>(null);

  const record = useMutation({
    mutationFn: (recording: Recording) => recordWorkout(equipment.id, recording).then((result) => ({ ...result, recording })),
    onSuccess: async (result) => {
      setLast(result);
      // The next submission is a new recording, unless the same one is sent again on purpose.
      setRecordingId(newRecordingId());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workout-tracking', 'workouts', pairedMemberId] }),
        queryClient.invalidateQueries({ queryKey: ['training-progress'] }),
      ]);
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    record.mutate({ recordingId, discipline, startedAt: new Date(startedAt).toISOString(), ...workoutMetricsOf(metrics) });
  };

  return (
    <form className="subform" onSubmit={submit}>
      <h3>Recording for {pairedMemberId}</h3>
      <div className="form-grid">
        <Field label="Discipline">
          <select value={discipline} onChange={(event) => setDiscipline(event.target.value as Discipline)}>
            {supported.map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Started at" hint="Not in the future">
          <input type="datetime-local" required value={startedAt} onChange={(event) => setStartedAt(event.target.value)} />
        </Field>
        <WorkoutMetricsFields value={metrics} onChange={setMetrics} />
        <Field label="Recording id" hint="The equipment's own id: sent again, it never creates a second workout">
          <input required maxLength={128} value={recordingId} onChange={(event) => setRecordingId(event.target.value)} />
        </Field>
      </div>
      <div className="form-actions">
        <button type="submit" className="primary" disabled={record.isPending}>
          {record.isPending ? 'Recording…' : 'Record workout'}
        </button>
        {last && (
          <button type="button" onClick={() => record.mutate(last.recording)} disabled={record.isPending}>
            Send the same recording again
          </button>
        )}
      </div>
      <ErrorNote error={record.error} />
      {last && !record.isPending && !record.error && (
        <Note tone={last.duplicate ? 'info' : 'success'}>
          {last.duplicate ? (
            <>
              <strong>Duplicate recording</strong> (200): Workout Tracking answered with the existing workout <code>{last.workout.id}</code>.
              Nothing new was recorded, and no event was published.
            </>
          ) : (
            <>
              <strong>Recorded</strong> (201): workout <code>{last.workout.id}</code>, revision {last.workout.revision}. Training Progress
              logs it when the event arrives: see <Link to="/">Training</Link>.
            </>
          )}
        </Note>
      )}
    </form>
  );
}
