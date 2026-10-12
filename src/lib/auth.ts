import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { SESSION_COOKIE, versaoValida, verifySessionToken } from './sessao';

export { APARELHO_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE, checkPassword, createSessionToken, isLoginConfigured } from './sessao';

export const isAuthenticated = cache(async () => {
  const store = await cookies();
  return versaoValida(verifySessionToken(store.get(SESSION_COOKIE)?.value));
});

export async function requireAuth() {
  if (!(await isAuthenticated())) redirect('/login');
}
