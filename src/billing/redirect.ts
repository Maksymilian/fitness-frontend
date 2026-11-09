/**
 * Leaves the app for the payment provider's page (checkout or billing portal), which sends the
 * member back to Billing's `MEMBERSHIP_PAGE_URL`. The URL comes from an API, so only an HTTPS page:
 * never a `javascript:` or `data:` URL. (No list of the provider's hosts: Checkout can run on a
 * custom domain.)
 */
export function redirectTo(url: string, navigate: (href: string) => void = (href) => window.location.assign(href)): void {
  const target = new URL(url);
  if (target.protocol !== 'https:') {
    throw new Error(`Refusing to leave the app for a ${target.protocol} URL: the payment provider's pages are HTTPS`);
  }
  navigate(target.href);
}
