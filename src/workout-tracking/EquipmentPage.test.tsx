import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { json, mockFetch, type SentRequest } from '../test/fetch';
import { renderPage } from '../test/render';
import { EquipmentPage } from './EquipmentPage';
import { TEST_EQUIPMENT_IDS } from './known-equipment';

const [ADAS_BIKE] = TEST_EQUIPMENT_IDS;

const bike = {
  id: ADAS_BIKE,
  serialNumber: 'BK-0001',
  type: 'BIKE',
  pairedMemberId: 'ada@example.com',
  pairedAt: '2026-10-01T08:00:00.000Z',
  registeredAt: '2026-10-01T07:00:00.000Z',
};

function workout(recordingId: string) {
  return {
    id: 'w1',
    equipmentId: ADAS_BIKE,
    equipmentType: 'BIKE',
    recordingId,
    memberId: 'ada@example.com',
    discipline: 'CYCLING',
    startedAt: '2026-11-09T10:00:00.000Z',
    durationSeconds: 1800,
    distanceMeters: 5000,
    calories: 250,
    status: 'RECORDED',
    revision: 1,
    voidReason: null,
    voidedAt: null,
    recordedAt: '2026-11-09T10:45:00.000Z',
  };
}

describe('EquipmentPage', () => {
  it('records a workout on paired equipment, and answers a duplicate recording with the existing workout', async () => {
    const recordings: SentRequest[] = [];
    mockFetch((request) => {
      if (request.method === 'POST' && request.url.endsWith('/recordings')) {
        recordings.push(request);
        const { recordingId } = request.body as { recordingId: string };
        return json(workout(recordingId), recordings.length === 1 ? 201 : 200);
      }
      if (request.url.endsWith(`/equipment/${ADAS_BIKE}`)) return json(bike);
      return json({ statusCode: 404, code: 'EquipmentNotFound', message: 'Equipment not found' }, 404);
    });
    renderPage(<EquipmentPage />, { route: '/equipment' });

    await userEvent.click(await screen.findByRole('button', { name: 'Record a workout' }));
    expect(screen.getByLabelText('Discipline')).toHaveDisplayValue('Cycling');
    await userEvent.click(screen.getByRole('button', { name: 'Record workout' }));

    expect(await screen.findByText(/Training Progress logs it when the event arrives/)).toBeInTheDocument();
    expect(recordings[0]?.url).toBe(`/api/workout-tracking/internal/v1/equipment/${ADAS_BIKE}/recordings`);
    expect(recordings[0]?.body).toMatchObject({ discipline: 'CYCLING', durationSeconds: 1800, distanceMeters: 5000, calories: 250 });

    await userEvent.click(screen.getByRole('button', { name: 'Send the same recording again' }));

    expect(await screen.findByText('Duplicate recording')).toBeInTheDocument();
    expect(recordings).toHaveLength(2);
    expect(recordings[1]?.body).toEqual(recordings[0]?.body);
  });

  it('says when the test equipment isn’t in Workout Tracking', async () => {
    mockFetch(() => json({ statusCode: 404, code: 'EquipmentNotFound', message: 'Equipment not found' }, 404));

    renderPage(<EquipmentPage />, { route: '/equipment' });

    await waitFor(() => expect(screen.getAllByText('Workout Tracking has no equipment with this id.')).toHaveLength(TEST_EQUIPMENT_IDS.length));
  });
});
