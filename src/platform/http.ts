import { flowHeaders } from './flow';

/**
 * A request a service refused, or couldn't answer. `status` is 0 when the service didn't answer at
 * all. `code` is the domain error's name when the service sent one (`EquipmentAlreadyPaired`,
 * `GoalAllowanceReached`), else GraphQL's `extensions.code` (`TIMEOUT`, `TOO_MANY_REQUESTS`).
 */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly service: string;
  readonly status: number;
  readonly code: string | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(service: string, status: number, message: string, code?: string, retryAfterSeconds?: number) {
    super(message);
    this.service = service;
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  get unreachable(): boolean {
    return this.status === 0;
  }
}

export interface ServiceResponse<T> {
  status: number;
  body: T;
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** A JSON client for one service: every request carries the tab's flow. */
export interface ServiceClient {
  readonly service: string;
  send<T>(method: Method, path: string, body?: unknown): Promise<ServiceResponse<T>>;
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  delete(path: string): Promise<void>;
}

export function serviceClient(service: string, baseUrl: string): ServiceClient {
  async function send<T>(method: Method, path: string, body?: unknown): Promise<ServiceResponse<T>> {
    const headers: Record<string, string> = { Accept: 'application/json', ...flowHeaders() };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw unreachable(service);
    }
    if (!response.ok) {
      throw await errorOf(service, response);
    }
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : undefined) as T };
  }

  return {
    service,
    send,
    get: async <T>(path: string) => (await send<T>('GET', path)).body,
    post: async <T>(path: string, body?: unknown) => (await send<T>('POST', path, body)).body,
    put: async <T>(path: string, body?: unknown) => (await send<T>('PUT', path, body)).body,
    delete: async (path: string) => {
      await send<undefined>('DELETE', path);
    },
  };
}

export function unreachable(service: string): ApiError {
  return new ApiError(service, 0, `${service} isn't answering. Is it running?`);
}

/**
 * Nest's error bodies: a domain error is `{ statusCode, code, message }`, a validation error
 * `{ statusCode, message: string[], error }`. A 5xx without a JSON body came from the proxy: the
 * service isn't running.
 */
export async function errorOf(service: string, response: Response): Promise<ApiError> {
  const retryAfter = Number(response.headers.get('Retry-After')) || undefined;
  const body: unknown = await response.json().catch(() => undefined);
  if (isRecord(body) && body.message !== undefined) {
    const message = Array.isArray(body.message) ? body.message.join('; ') : String(body.message);
    const code = typeof body.code === 'string' ? body.code : undefined;
    return new ApiError(service, response.status, message, code, retryAfter);
  }
  if (response.status >= 500 && body === undefined) {
    return new ApiError(service, response.status, `${service} isn't answering (${response.status}). Is it running?`);
  }
  return new ApiError(service, response.status, `${service} answered ${response.status}`, undefined, retryAfter);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
