import 'server-only';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// A senha e o segredo da sessão vêm das variáveis de ambiente da Vercel:
//   ORIGO_PASSWORD         senha de acesso ao Origo OS
//   ORIGO_SESSION_SECRET   texto longo e aleatório para assinar a sessão

export const SESSION_COOKIE = 'origo_session';
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

function env(name: string) {
  const value = process.env[name]?.trim().replace(/^['"]|['"]$/g, '');
  return value ? value : undefined;
}

export function isLoginConfigured() {
  return !!env('ORIGO_PASSWORD') && !!env('ORIGO_SESSION_SECRET');
}

function safeEqual(a: string, b: string) {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}

export function checkPassword(password: unknown) {
  const expected = env('ORIGO_PASSWORD');
  return !!expected && typeof password === 'string' && safeEqual(password, expected);
}

function sign(payload: string) {
  return createHmac('sha256', env('ORIGO_SESSION_SECRET')!).update(payload).digest('base64url');
}

export function createSessionToken() {
  const payload = `${Date.now() + SESSION_MAX_AGE * 1000}.${randomUUID()}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined) {
  if (!token || !isLoginConfigured()) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [expires, nonce, signature] = parts;
  const expected = Buffer.from(sign(`${expires}.${nonce}`));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false;
  return Number(expires) > Date.now();
}

export async function isAuthenticated() {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function requireAuth() {
  if (!(await isAuthenticated())) redirect('/login');
}
