import { vi } from 'vitest';

export interface SentRequest {
  method: string;
  url: string;
  headers: Headers;
  body: unknown;
}

/** Replaces `fetch` with a handler; returns the requests sent, in order. */
export function mockFetch(handler: (request: SentRequest) => Response | Promise<Response>): SentRequest[] {
  const sent: SentRequest[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request: SentRequest = {
        method: init?.method ?? 'GET',
        url: String(input),
        headers: new Headers(init?.headers),
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      };
      sent.push(request);
      return handler(request);
    }),
  );
  return sent;
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

/** The GraphQL operation's name: `query TrainingGoals(...)` → `TrainingGoals`. */
export function operationName(request: SentRequest): string | undefined {
  const query = (request.body as { query?: string } | undefined)?.query ?? '';
  return /^\s*(?:query|mutation)\s+(\w+)/.exec(query)?.[1];
}

export function variables(request: SentRequest): Record<string, unknown> {
  return (request.body as { variables?: Record<string, unknown> }).variables ?? {};
}
