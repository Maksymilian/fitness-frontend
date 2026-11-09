import { ApiError, serviceClient } from '../platform/http';
import { SERVICES } from '../platform/services';

/**
 * Billing's REST API (fitness-backend's `docs/architecture.md`, 18.2): the membership, the payment provider's pages
 * that change it, and the ledger. Until Identity exists, the member is in the path.
 */
const billing = serviceClient(SERVICES.billing.name, `${SERVICES.billing.url}/v1`);

export type MembershipPlan = 'MONTHLY' | 'YEARLY';
export type MembershipStatus = 'ACTIVE' | 'ENDED';
export type LedgerEntryKind = 'PAYMENT' | 'REFUND';

export const MEMBERSHIP_PLANS: readonly MembershipPlan[] = ['MONTHLY', 'YEARLY'];

export interface Membership {
  id: string;
  memberId: string;
  plan: MembershipPlan;
  status: MembershipStatus;
  paidThrough: string;
  renews: boolean;
  startedAt: string;
  endedAt: string | null;
}

/** `amount` is exact text ("9.99"), never a float. */
export interface LedgerEntry {
  id: string;
  kind: LedgerEntryKind;
  amount: string;
  currency: string;
  occurredAt: string;
  plan: MembershipPlan | null;
  paidThrough: string | null;
}

export interface LedgerPage {
  entries: LedgerEntry[];
  nextCursor: string | null;
}

function memberPath(memberId: string): string {
  return `/members/${encodeURIComponent(memberId)}`;
}

/** The member's membership, or null if they never had one. */
export async function getMembership(memberId: string): Promise<Membership | null> {
  try {
    return await billing.get<Membership>(`${memberPath(memberId)}/membership`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/** The URL of the payment provider's checkout for the plan. The membership starts once the member paid there. */
export async function startCheckout(memberId: string, plan: MembershipPlan): Promise<string> {
  return (await billing.post<{ url: string }>(`${memberPath(memberId)}/checkouts`, { plan })).url;
}

/** The URL of the payment provider's billing portal: switch plans, cancel or resume renewal, change the card. */
export async function openBillingPortal(memberId: string): Promise<string> {
  return (await billing.post<{ url: string }>(`${memberPath(memberId)}/billing-portal`)).url;
}

export function getLedger(memberId: string, cursor: string | null, limit = 20): Promise<LedgerPage> {
  const query = new URLSearchParams({ limit: String(limit), cursor: cursor ?? '' });
  return billing.get(`${memberPath(memberId)}/ledger?${query}`);
}
