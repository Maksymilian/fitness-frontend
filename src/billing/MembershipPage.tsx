import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useMember } from '../app/member-context';
import { formatDateTime, formatMoney, formatUtcDay, humanize } from '../platform/format';
import { Badge, Empty, ErrorNote, Loading, Note, Panel } from '../platform/ui';
import { getLedger, getMembership, type Membership, MEMBERSHIP_PLANS, type MembershipPlan, openBillingPortal, startCheckout } from './api';
import { redirectTo } from './redirect';

/** After a checkout, Stripe tells Billing about the payment in a moment: ask again until then. */
const POLL_AFTER_CHECKOUT_MS = 60_000;

export function MembershipPage() {
  const { memberId } = useMember();
  const [searchParams] = useSearchParams();
  const checkout = searchParams.get('checkout');
  const [pollUntil] = useState(() => (checkout === 'completed' ? Date.now() + POLL_AFTER_CHECKOUT_MS : 0));

  const membership = useQuery({
    queryKey: ['billing', 'membership', memberId],
    queryFn: () => getMembership(memberId),
    refetchInterval: (query) => (query.state.data?.status !== 'ACTIVE' && Date.now() < pollUntil ? 2000 : false),
  });

  return (
    <>
      <div className="page-heading">
        <h1>Membership</h1>
      </div>
      {checkout === 'completed' && (
        <Note tone="success">
          Thank you. Billing starts the membership as soon as the payment provider reports the payment, usually within seconds.
        </Note>
      )}
      {checkout === 'abandoned' && <Note tone="warning">Checkout abandoned: nothing was paid.</Note>}

      <Panel title="Membership" service="billing">
        <ErrorNote error={membership.error} />
        {membership.isPending && <Loading what="the membership" />}
        {membership.isSuccess &&
          (membership.data ? <MembershipDetails membership={membership.data} memberId={memberId} /> : <NoMembership memberId={memberId} />)}
      </Panel>

      <Ledger memberId={memberId} />
    </>
  );
}

function MembershipDetails({ membership, memberId }: { membership: Membership; memberId: string }) {
  const active = membership.status === 'ACTIVE';
  return (
    <>
      <dl className="details">
        <div>
          <dt>Status</dt>
          <dd>
            <Badge tone={active ? 'good' : 'neutral'}>{humanize(membership.status)}</Badge>
          </dd>
        </div>
        <div>
          <dt>Membership plan</dt>
          <dd>{humanize(membership.plan)}</dd>
        </div>
        <div>
          <dt>Paid through</dt>
          <dd>{formatUtcDay(membership.paidThrough)}</dd>
        </div>
        <div>
          <dt>Renewal</dt>
          <dd>{active ? (membership.renews ? 'On: paid again when it is paid through' : 'Off: it ends when it is paid through') : '–'}</dd>
        </div>
        <div>
          <dt>Started</dt>
          <dd>{formatDateTime(membership.startedAt)}</dd>
        </div>
        {membership.endedAt && (
          <div>
            <dt>Ended</dt>
            <dd>{formatDateTime(membership.endedAt)}</dd>
          </div>
        )}
      </dl>
      {active ? <BillingPortalButton memberId={memberId} /> : <PlanChoice memberId={memberId} intro="Start it again on a membership plan:" />}
    </>
  );
}

function NoMembership({ memberId }: { memberId: string }) {
  return (
    <>
      <Empty>No membership yet. With one, a member may hold any number of active training goals; without, one.</Empty>
      <PlanChoice memberId={memberId} intro="Choose a membership plan, then pay on the payment provider's page:" />
    </>
  );
}

function PlanChoice({ memberId, intro }: { memberId: string; intro: string }) {
  const checkout = useMutation({
    mutationFn: async (plan: MembershipPlan) => redirectTo(await startCheckout(memberId, plan)),
  });
  return (
    <div className="plan-choice">
      <p>{intro}</p>
      <div className="row-actions">
        {MEMBERSHIP_PLANS.map((plan) => (
          <button key={plan} type="button" className="primary" onClick={() => checkout.mutate(plan)} disabled={checkout.isPending}>
            {checkout.isPending && checkout.variables === plan ? 'Opening checkout…' : `Pay ${humanize(plan).toLowerCase()}`}
          </button>
        ))}
      </div>
      <ErrorNote error={checkout.error} />
    </div>
  );
}

function BillingPortalButton({ memberId }: { memberId: string }) {
  const portal = useMutation({ mutationFn: async () => redirectTo(await openBillingPortal(memberId)) });
  return (
    <div className="row-actions">
      <button type="button" className="primary" onClick={() => portal.mutate()} disabled={portal.isPending}>
        {portal.isPending ? 'Opening…' : 'Open billing portal'}
      </button>
      <span className="muted small">Switch plans, cancel or resume renewal, change the card, read invoices.</span>
      <ErrorNote error={portal.error} />
    </div>
  );
}

function Ledger({ memberId }: { memberId: string }) {
  const ledger = useInfiniteQuery({
    queryKey: ['billing', 'ledger', memberId],
    queryFn: ({ pageParam }) => getLedger(memberId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const entries = ledger.data?.pages.flatMap((page) => page.entries) ?? [];

  return (
    <Panel title="Ledger" service="billing">
      <ErrorNote error={ledger.error} />
      {ledger.isPending && <Loading what="the ledger" />}
      {ledger.isSuccess && entries.length === 0 && <Empty>No payments or refunds yet.</Empty>}
      {entries.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Occurred at</th>
                <th scope="col">Ledger entry</th>
                <th scope="col" className="numeric">
                  Amount
                </th>
                <th scope="col">Membership plan</th>
                <th scope="col">Paid through</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.occurredAt)}</td>
                  <td>
                    <Badge tone={entry.kind === 'PAYMENT' ? 'good' : 'warn'}>{humanize(entry.kind)}</Badge>
                  </td>
                  <td className="numeric">
                    {entry.kind === 'REFUND' ? '−' : ''}
                    {formatMoney(entry.amount, entry.currency)}
                  </td>
                  <td>{entry.plan ? humanize(entry.plan) : '–'}</td>
                  <td>{entry.paidThrough ? formatUtcDay(entry.paidThrough) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ledger.hasNextPage && (
        <button type="button" className="load-more" onClick={() => void ledger.fetchNextPage()} disabled={ledger.isFetchingNextPage}>
          {ledger.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}
    </Panel>
  );
}
