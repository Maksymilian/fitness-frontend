import { describe, expect, it } from 'vitest';
import { json, mockFetch } from '../test/fetch';
import { flowId } from './flow';
import { ApiError, serviceClient } from './http';

const client = serviceClient('Workout Tracking', '/api/workout-tracking/internal/v1');

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe('serviceClient', () => {
  it('sends JSON with the tab’s flow as W3C Baggage', async () => {
    const sent = mockFetch(() => json({ id: 'e1' }, 201));

    await client.post('/equipment', { serialNumber: 'BK-0042', type: 'BIKE' });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe('/api/workout-tracking/internal/v1/equipment');
    expect(sent[0]?.headers.get('baggage')).toBe(`session.id=${flowId()}`);
    expect(sent[0]?.headers.get('content-type')).toBe('application/json');
    expect(sent[0]?.body).toEqual({ serialNumber: 'BK-0042', type: 'BIKE' });
  });

  it('keeps the same flow for every request of the tab', async () => {
    const sent = mockFetch(() => json({}));

    await client.get('/workouts/w1');
    await client.get('/workouts/w2');

    expect(sent[0]?.headers.get('baggage')).toBe(sent[1]?.headers.get('baggage'));
  });

  it('returns the status with the body, for answers that differ only by status', async () => {
    mockFetch(() => json({ id: 'w1' }, 200));

    await expect(client.send('POST', '/equipment/e1/recordings', {})).resolves.toEqual({ status: 200, body: { id: 'w1' } });
  });

  it('resolves an empty answer (204) to undefined', async () => {
    mockFetch(() => new Response(null, { status: 204 }));

    await expect(client.delete('/equipment/e1/pairing')).resolves.toBeUndefined();
  });

  it('reports a domain error with its name as the code', async () => {
    mockFetch(() => json({ statusCode: 409, code: 'EquipmentAlreadyPaired', message: 'Equipment is paired with another member' }, 409));

    const error = await failure(client.put('/equipment/e1/pairing', { memberId: 'grace@example.com' }));

    expect(error).toMatchObject({ status: 409, code: 'EquipmentAlreadyPaired', message: 'Equipment is paired with another member' });
  });

  it('joins the messages of a validation error', async () => {
    mockFetch(() => json({ statusCode: 400, message: ['serialNumber must be a string', 'type must be one of BIKE, TREADMILL, ROWER'], error: 'Bad Request' }, 400));

    const error = await failure(client.post('/equipment', {}));

    expect(error.status).toBe(400);
    expect(error.message).toBe('serialNumber must be a string; type must be one of BIKE, TREADMILL, ROWER');
  });

  it('reads Retry-After when the rate limit refuses a request', async () => {
    mockFetch(() => json({ statusCode: 429, message: 'ThrottlerException: Too Many Requests' }, 429, { 'Retry-After': '42' }));

    const error = await failure(client.get('/workouts/w1'));

    expect(error).toMatchObject({ status: 429, retryAfterSeconds: 42 });
  });

  it('says the service is not answering when the proxy answers without a body', async () => {
    mockFetch(() => new Response('', { status: 500 }));

    const error = await failure(client.get('/workouts/w1'));

    expect(error.message).toBe("Workout Tracking isn't answering (500). Is it running?");
  });

  it('says the service is not answering when the request fails', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));

    const error = await failure(client.get('/workouts/w1'));

    expect(error.unreachable).toBe(true);
    expect(error.message).toBe("Workout Tracking isn't answering. Is it running?");
  });
});
