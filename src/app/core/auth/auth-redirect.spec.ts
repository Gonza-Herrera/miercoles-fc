import { createAuthCallbackUrl, normalizeReturnUrl } from './auth-redirect';

describe('auth redirect helpers', () => {
  it('keeps safe internal return URLs', () => {
    expect(normalizeReturnUrl('/payments?from=invite#pending')).toBe(
      '/payments?from=invite#pending',
    );
  });

  it.each(['https://attacker.example', '//attacker.example', '/auth', '/auth/callback'])(
    'rejects unsafe return URL %s',
    (value) => {
      expect(normalizeReturnUrl(value)).toBe('/');
    },
  );

  it('builds one callback URL from the current application origin', () => {
    expect(createAuthCallbackUrl('https://app.example', '/payments')).toBe(
      'https://app.example/auth/callback?returnUrl=%2Fpayments',
    );
  });
});
