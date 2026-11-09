import { cloneElement, type ReactElement, type ReactNode, useId } from 'react';
import { ApiError } from './http';
import { SERVICES, type ServiceKey } from './services';

/** A section of a page, labelled with the service (bounded context) its data comes from. */
export function Panel({ title, service, actions, children }: { title: string; service?: ServiceKey; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel" aria-label={title}>
      <header className="panel-header">
        <h2>{title}</h2>
        {service && <ServiceTag service={service} />}
        {actions && <div className="panel-actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

export function ServiceTag({ service }: { service: ServiceKey }) {
  const { name, api } = SERVICES[service];
  return (
    <span className={`service-tag service-${service}`} title={`From ${name}'s ${api} API`}>
      {name} · {api}
    </span>
  );
}

/** A request that failed, in the service's words. */
export function ErrorNote({ error, children }: { error: unknown; children?: ReactNode }) {
  if (!error) {
    return null;
  }
  const message = error instanceof Error ? error.message : String(error);
  const retry = error instanceof ApiError && error.retryAfterSeconds ? ` Try again in ${error.retryAfterSeconds} s.` : '';
  const code = error instanceof ApiError && error.code ? <code className="error-code">{error.code}</code> : null;
  return (
    <div className="note note-error" role="alert">
      <p>
        {code} {message}
        {retry}
      </p>
      {children}
    </div>
  );
}

export function Note({ tone = 'info', children }: { tone?: 'info' | 'success' | 'warning'; children: ReactNode }) {
  return (
    <div className={`note note-${tone}`} role="status">
      {children}
    </div>
  );
}

export function Loading({ what }: { what: string }) {
  return (
    <p className="muted" aria-busy="true">
      Loading {what}…
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

/** A labelled input. The hint describes the input (`aria-describedby`) without becoming part of its name. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactElement<{ 'aria-describedby'?: string }> }) {
  const hintId = useId();
  return (
    <div className="field">
      <label className="field-inner">
        <span className="field-label">{label}</span>
        {hint ? cloneElement(children, { 'aria-describedby': hintId }) : children}
      </label>
      {hint && (
        <span id={hintId} className="field-hint">
          {hint}
        </span>
      )}
    </div>
  );
}

export function Badge({ tone, children }: { tone: 'neutral' | 'good' | 'bad' | 'warn'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
