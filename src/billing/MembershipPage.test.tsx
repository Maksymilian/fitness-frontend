import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { json, mockFetch } from '../test/fetch';
import { renderPage } from '../test/render';
import { MembershipPage } from './MembershipPage';
import { redirectTo } from './redirect';

vi.mock('./redirect', () => ({ redirectTo: vi.fn() }));

const ADA_MEMBERSHIP = '/api/billing/v1/members/ada%40example.com/membership';
const ADA_LEDGER = '/api/billing/v1/members/ada%40example.com/ledger?limit=20&cursor=';

describe('MembershipPage', () => {
  it('offers the membership plans to a member who never had one, and opens the checkout for the chosen plan', async () => {
    const sent = mockFetch(({ method, url }) => {
      if (url === ADA_MEMBERSHIP) return json({ statusCode: 404, code: 'MembershipNotFound', message: 'No membership' }, 404);
      if (url === ADA_LEDGER) return json({ entries: [], nextCursor: null });
      if (method === 'POST' && url.endsWith('/checkouts')) return json({ url: 'https://checkout.stripe.com/c/pay/cs_test_123' }, 201);
      throw new Error(`Unexpected ${method} ${url}`);
    });
    renderPage(<MembershipPage />, { route: '/membership' });

    expect(await screen.findByText(/No membership yet/)).toBeInTheDocument();
    expect(await screen.findByText('No payments or refunds yet.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pay yearly' }));

    expect(sent.find((request) => request.method === 'POST')?.body).toEqual({ plan: 'YEARLY' });
    expect(redirectTo).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_123');
  });

  it('says why a checkout can’t start when payments aren’t set up', async () => {
    mockFetch(({ method, url }) => {
      if (url === ADA_MEMBERSHIP) return json({ statusCode: 404, message: 'No membership' }, 404);
      if (url === ADA_LEDGER) return json({ entries: [], nextCursor: null });
      if (method === 'POST') return json({ statusCode: 503, message: 'The payment provider is not configured: set STRIPE_SECRET_KEY' }, 503);
      throw new Error(`Unexpected ${method} ${url}`);
    });
    renderPage(<MembershipPage />, { route: '/membership' });

    await userEvent.click(await screen.findByRole('button', { name: 'Pay monthly' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The payment provider is not configured: set STRIPE_SECRET_KEY');
    expect(redirectTo).not.toHaveBeenCalled();
  });

  it('shows an active membership, its ledger, and the billing portal', async () => {
    mockFetch(({ url }) => {
      if (url === ADA_MEMBERSHIP) {
        return json({
          id: 'm1',
          memberId: 'ada@example.com',
          plan: 'MONTHLY',
          status: 'ACTIVE',
          paidThrough: '2026-12-01T07:00:00.000Z',
          renews: false,
          startedAt: '2026-10-01T07:00:00.000Z',
          endedAt: null,
        });
      }
      if (url === ADA_LEDGER) {
        return json({
          entries: [
            { id: 'l2', kind: 'REFUND', amount: '2.50', currency: 'EUR', occurredAt: '2026-11-03T10:00:00.000Z', plan: null, paidThrough: null },
            { id: 'l1', kind: 'PAYMENT', amount: '9.99', currency: 'EUR', occurredAt: '2026-11-01T07:00:00.000Z', plan: 'MONTHLY', paidThrough: '2026-12-01T07:00:00.000Z' },
          ],
          nextCursor: null,
        });
      }
      throw new Error(`Unexpected ${url}`);
    });
    renderPage(<MembershipPage />, { route: '/membership' });

    expect(await screen.findByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Off: it ends when it is paid through')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open billing portal' })).toBeInTheDocument();
    expect(await screen.findByText('€9.99')).toBeInTheDocument();
    expect(screen.getByText('−€2.50')).toBeInTheDocument();
  });

  it('thanks the member back from the checkout, while Billing waits for the payment', async () => {
    mockFetch(({ url }) => (url === ADA_MEMBERSHIP ? json({ statusCode: 404, message: 'No membership' }, 404) : json({ entries: [], nextCursor: null })));

    renderPage(<MembershipPage />, { route: '/membership?checkout=completed' });

    expect(await screen.findByText(/Billing starts the membership as soon as the payment provider reports the payment/)).toBeInTheDocument();
  });
});
