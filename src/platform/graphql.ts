import { flowHeaders } from './flow';
import { ApiError, errorOf, isRecord, unreachable } from './http';

interface GraphQLErrorBody {
  message: string;
  extensions?: {
    code?: string;
    reason?: string;
    retryAfter?: number;
    originalError?: { message?: string | string[] };
  };
}

/**
 * Sends one GraphQL operation. A field error fails the whole operation with the first error: the
 * domain error's name (`extensions.reason`) as its code when there is one, else `extensions.code`.
 * Domain errors and timeouts answer 200; only the rate limit answers 429.
 */
export function graphqlClient(service: string, url: string) {
  return async function request<TData, TVariables extends Record<string, unknown> = Record<string, unknown>>(
    document: string,
    variables?: TVariables,
  ): Promise<TData> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...flowHeaders() },
        body: JSON.stringify({ query: document, variables }),
      });
    } catch {
      throw unreachable(service);
    }
    const body: unknown = await response
      .clone()
      .json()
      .catch(() => undefined);
    if (!isRecord(body)) {
      throw await errorOf(service, response);
    }
    const errors = body.errors as GraphQLErrorBody[] | undefined;
    const first = errors?.[0];
    if (first) {
      const extensions = first.extensions ?? {};
      const details = extensions.originalError?.message;
      const message = Array.isArray(details) ? details.join('; ') : (details ?? first.message);
      throw new ApiError(service, response.status, message, extensions.reason ?? extensions.code, extensions.retryAfter);
    }
    if (!response.ok) {
      throw await errorOf(service, response);
    }
    return body.data as TData;
  };
}
