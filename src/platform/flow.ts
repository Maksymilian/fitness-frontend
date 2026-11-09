const FLOW_KEY = 'flow-id';
let fallbackFlowId: string | undefined;

/**
 * This tab's flow: one interaction of the member with the app, over many requests and all three
 * services. The services read it from W3C Baggage (`session.id`) and put it on every span and log
 * record, so a whole session in the app can be found in Grafana (fitness-backend's `docs/architecture.md`, 15.2).
 * A new tab is a new flow; reloading the page keeps it.
 */
export function flowId(): string {
  try {
    const stored = sessionStorage.getItem(FLOW_KEY);
    if (stored) {
      return stored;
    }
    const created = crypto.randomUUID();
    sessionStorage.setItem(FLOW_KEY, created);
    return created;
  } catch {
    // Storage blocked: the flow lasts until the page is reloaded.
    fallbackFlowId ??= crypto.randomUUID();
    return fallbackFlowId;
  }
}

export function flowHeaders(): Record<string, string> {
  return { baggage: `session.id=${flowId()}` };
}
