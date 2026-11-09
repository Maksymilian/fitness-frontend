import { useQueries } from '@tanstack/react-query';
import { SERVICES, type ServiceKey } from '../platform/services';

type Readiness = 'ready' | 'not-ready' | 'down';

/** Terminus' readiness: 200 ready, 503 a dependency (PostgreSQL, RabbitMQ, Redis) isn't. */
async function readiness(service: ServiceKey): Promise<Readiness> {
  try {
    const response = await fetch(`${SERVICES[service].url}/health/ready`, { headers: { Accept: 'application/json' } });
    if (response.ok) {
      return 'ready';
    }
    // Without a JSON body, the answer came from the proxy: the service isn't running.
    return (await response.json().catch(() => undefined)) === undefined ? 'down' : 'not-ready';
  } catch {
    return 'down';
  }
}

const LABEL: Record<Readiness, string> = { ready: 'ready', 'not-ready': 'not ready', down: 'not answering' };

export function ServiceHealth() {
  const services = Object.keys(SERVICES) as ServiceKey[];
  const results = useQueries({
    queries: services.map((service) => ({
      queryKey: ['health', service],
      queryFn: () => readiness(service),
      refetchInterval: 15_000,
    })),
  });
  return (
    <ul className="service-health" aria-label="Services">
      {services.map((service, index) => {
        const state = results[index]?.data;
        return (
          <li key={service} className={`health health-${state ?? 'unknown'}`} title={`${SERVICES[service].name}: ${state ? LABEL[state] : 'checking'}`}>
            <span className="health-dot" aria-hidden="true" />
            {SERVICES[service].name}
            <span className="visually-hidden">: {state ? LABEL[state] : 'checking'}</span>
          </li>
        );
      })}
    </ul>
  );
}
