import { describe, expect, it } from 'vitest';
import { json, mockFetch } from '../test/fetch';
import { flowId } from './flow';
import { graphqlClient } from './graphql';
import { ApiError } from './http';

const request = graphqlClient('Training Progress', '/api/training-progress/graphql');

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe('graphqlClient', () => {
  it('posts the operation and its variables, with the flow, and returns its data', async () => {
    const sent = mockFetch(() => json({ data: { member: { streak: 3 } } }));

    const data = await request('query Streak($id: ID!) { member(id: $id) { streak } }', { id: 'ada@example.com' });

    expect(data).toEqual({ member: { streak: 3 } });
    expect(sent[0]?.method).toBe('POST');
    expect(sent[0]?.headers.get('baggage')).toBe(`session.id=${flowId()}`);
    expect(sent[0]?.body).toEqual({ query: 'query Streak($id: ID!) { member(id: $id) { streak } }', variables: { id: 'ada@example.com' } });
  });

  it('fails with the domain error’s name, which GraphQL carries as the reason', async () => {
    mockFetch(() =>
      json({
        data: null,
        errors: [{ message: 'The goal allowance is reached', extensions: { code: 'CONFLICT', reason: 'GoalAllowanceReached' } }],
      }),
    );

    const error = await failure(request('mutation SetTrainingGoal { setTrainingGoal { id } }'));

    expect(error).toMatchObject({ status: 200, code: 'GoalAllowanceReached', message: 'The goal allowance is reached' });
  });

  it('fails with the GraphQL code when there is no domain error, such as a timeout', async () => {
    mockFetch(() => json({ data: null, errors: [{ message: 'The query took too long', extensions: { code: 'TIMEOUT' } }] }));

    const error = await failure(request('query Streak { member(id: "a@b.c") { streak } }'));

    expect(error.code).toBe('TIMEOUT');
  });

  it('reads the rate limit’s rejection: 429, TOO_MANY_REQUESTS and when to try again', async () => {
    mockFetch(() =>
      json({ errors: [{ message: 'Too many requests', extensions: { code: 'TOO_MANY_REQUESTS', retryAfter: 17 } }] }, 429, { 'Retry-After': '17' }),
    );

    const error = await failure(request('query Streak { member(id: "a@b.c") { streak } }'));

    expect(error).toMatchObject({ status: 429, code: 'TOO_MANY_REQUESTS', retryAfterSeconds: 17 });
  });

  it('shows the messages of a validation error rather than "Bad Request Exception"', async () => {
    mockFetch(() =>
      json({
        data: null,
        errors: [
          {
            message: 'Bad Request Exception',
            extensions: { code: 'BAD_REQUEST', originalError: { message: ['id must be an email'], error: 'Bad Request', statusCode: 400 } },
          },
        ],
      }),
    );

    const error = await failure(request('query Streak { member(id: "nope") { streak } }'));

    expect(error.message).toBe('id must be an email');
  });

  it('says the service is not answering when the proxy answers without a body', async () => {
    mockFetch(() => new Response('', { status: 502 }));

    const error = await failure(request('query Streak { member(id: "a@b.c") { streak } }'));

    expect(error.message).toBe("Training Progress isn't answering (502). Is it running?");
  });
});
