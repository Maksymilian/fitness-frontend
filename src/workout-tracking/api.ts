import { serviceClient } from '../platform/http';
import { SERVICES } from '../platform/services';

/**
 * Workout Tracking's internal REST API (fitness-backend's `docs/architecture.md`, 5.2): equipment, pairing,
 * recordings, corrections and voids. Back-office work: the member app never calls it.
 */
const workoutTracking = serviceClient(SERVICES.workoutTracking.name, `${SERVICES.workoutTracking.url}/internal/v1`);

export type EquipmentType = 'BIKE' | 'TREADMILL' | 'ROWER';
export type Discipline = 'CYCLING' | 'RUNNING' | 'WALKING' | 'ROWING';
export type WorkoutStatus = 'RECORDED' | 'VOIDED';

export const EQUIPMENT_TYPES: readonly EquipmentType[] = ['BIKE', 'TREADMILL', 'ROWER'];

/**
 * The disciplines each equipment type supports (glossary: Supported Discipline), to offer only
 * those in the recording form. Workout Tracking checks it again: it's the rule's owner.
 */
export const SUPPORTED_DISCIPLINES: Readonly<Record<EquipmentType, readonly Discipline[]>> = {
  BIKE: ['CYCLING'],
  TREADMILL: ['RUNNING', 'WALKING'],
  ROWER: ['ROWING'],
};

export interface Equipment {
  id: string;
  serialNumber: string;
  type: EquipmentType;
  pairedMemberId: string | null;
  pairedAt: string | null;
  registeredAt: string;
}

export interface WorkoutMetrics {
  durationSeconds: number;
  distanceMeters: number;
  calories: number;
}

export interface Workout extends WorkoutMetrics {
  id: string;
  equipmentId: string;
  equipmentType: EquipmentType;
  recordingId: string;
  memberId: string;
  discipline: Discipline;
  startedAt: string;
  status: WorkoutStatus;
  revision: number;
  voidReason: string | null;
  voidedAt: string | null;
  recordedAt: string;
}

export interface WorkoutPage {
  workouts: Workout[];
  nextCursor: string | null;
}

export interface Recording extends WorkoutMetrics {
  recordingId: string;
  discipline: Discipline;
  startedAt: string;
}

export function registerEquipment(serialNumber: string, type: EquipmentType): Promise<Equipment> {
  return workoutTracking.post('/equipment', { serialNumber, type });
}

export function getEquipment(equipmentId: string): Promise<Equipment> {
  return workoutTracking.get(`/equipment/${encodeURIComponent(equipmentId)}`);
}

export function pairEquipment(equipmentId: string, memberId: string): Promise<Equipment> {
  return workoutTracking.put(`/equipment/${encodeURIComponent(equipmentId)}/pairing`, { memberId });
}

export function unpairEquipment(equipmentId: string): Promise<void> {
  return workoutTracking.delete(`/equipment/${encodeURIComponent(equipmentId)}/pairing`);
}

/** `duplicate`: the recording id was recorded already, and this is the existing workout (200, not 201). */
export async function recordWorkout(equipmentId: string, recording: Recording): Promise<{ workout: Workout; duplicate: boolean }> {
  const { status, body } = await workoutTracking.send<Workout>('POST', `/equipment/${encodeURIComponent(equipmentId)}/recordings`, recording);
  return { workout: body, duplicate: status === 200 };
}

/** A member's workouts, newest first, voided ones included. */
export function memberWorkouts(memberId: string, cursor: string | null, limit = 20): Promise<WorkoutPage> {
  const query = new URLSearchParams({ limit: String(limit), cursor: cursor ?? '' });
  return workoutTracking.get(`/members/${encodeURIComponent(memberId)}/workouts?${query}`);
}

export function correctWorkout(workoutId: string, metrics: WorkoutMetrics, reason: string): Promise<Workout> {
  return workoutTracking.post(`/workouts/${encodeURIComponent(workoutId)}/corrections`, { ...metrics, reason });
}

export function voidWorkout(workoutId: string, reason: string): Promise<Workout> {
  return workoutTracking.post(`/workouts/${encodeURIComponent(workoutId)}/void`, { reason });
}
