import { safeReturnPath, withCheckoutResult } from './paddle';

describe('/pay return path', () => {
  it('keeps a path on this site', () => {
    expect(safeReturnPath('/w/ws-1/settings/billing')).toBe('/w/ws-1/settings/billing');
  });

  it.each([null, '', 'https://evil.example/', '//evil.example/x', '/\\evil.example', 'javascript:alert(1)', '/w/\nx'])('refuses %p and goes home', (next) => {
    expect(safeReturnPath(next)).toBe('/');
  });

  it('adds the checkout result, keeping an existing query', () => {
    expect(withCheckoutResult('/w/1/settings/billing', 'success')).toBe('/w/1/settings/billing?checkout=success');
    expect(withCheckoutResult('/w/1/settings/billing?x=1', 'canceled')).toBe('/w/1/settings/billing?x=1&checkout=canceled');
  });
});
