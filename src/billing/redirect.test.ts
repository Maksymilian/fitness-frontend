import { describe, expect, it, vi } from 'vitest';
import { redirectTo } from './redirect';

describe('redirectTo', () => {
  it('leaves for the payment provider’s HTTPS page', () => {
    const navigate = vi.fn();

    redirectTo('https://checkout.stripe.com/c/pay/cs_test_123', navigate);

    expect(navigate).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_123');
  });

  it.each(['javascript:alert(1)', 'data:text/html,hi', 'http://checkout.stripe.com/c/pay/cs_test_123'])('refuses %s', (url) => {
    const navigate = vi.fn();

    expect(() => redirectTo(url, navigate)).toThrow(/Refusing to leave the app/);
    expect(navigate).not.toHaveBeenCalled();
  });
});
