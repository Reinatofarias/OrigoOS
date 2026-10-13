import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { db } from './db';

// Sessão do login. Usado pelo proxy (antes de cada página) e pelo servidor (em cada página e ação).
// A senha e o segredo da sessão vêm das variáveis de ambiente da Vercel:
//   ORIGO_PASSWORD         senha de acesso ao Origo OS
//   ORIGO_SESSION_SECRET   texto longo e aleatório para assinar a sessão

export const SESSION_COOKIE = 'origo_session';
export const APARELHO_COOKIE = 'origo_aparelho';
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

// A versão da sessão vai dentro do cookie. "Sair de todos os aparelhos" sobe a versão e derruba os cookies antigos.
export function createSessionToken(versao: number) {
  const payload = `${Date.now() + SESSION_MAX_AGE * 1000}.${randomUUID()}.${versao}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): number | null {
  if (!token || !isLoginConfigured()) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [expires, nonce, versao, signature] = parts;
  const expected = Buffer.from(sign(`${expires}.${nonce}.${versao}`));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  return Number(expires) > Date.now() ? Number(versao) : null;
}

// "Sair de todos os aparelhos" sobe a versão no banco. Guarda a versão por 15 segundos pra não consultar a cada clique;
// se o cookie trouxer uma versão diferente da guardada, confere no banco antes de recusar (login logo depois de sair de todos).
let memo: { versao: number; ate: number } | null = null;

async function versaoDoBanco() {
  const { data, error } = await db().from('settings').select('valor').eq('chave', 'seguranca').maybeSingle();
  if (error) throw new Error(error.message);
  const versao = Number((data?.valor as { sessao_versao?: number } | null)?.sessao_versao ?? 1);
  memo = { versao, ate: Date.now() + 15_000 };
  return versao;
}

export async function versaoValida(versao: number | null) {
  if (versao === null) return false;
  if (memo && memo.ate > Date.now() && memo.versao === versao) return true;
  return versao === (await versaoDoBanco());
}

export function esquecerVersao() {
  memo = null;
}

// Login em duas etapas: depois da senha certa, um cookie curto prova que a senha já passou e a tela pede só o código.
export const SENHA_OK_COOKIE = 'origo_senha_ok';
export const SENHA_OK_MAX_AGE = 5 * 60;

export function createSenhaOkToken() {
  const payload = `senha-ok.${Date.now() + SENHA_OK_MAX_AGE * 1000}.${randomUUID()}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySenhaOkToken(token: string | undefined) {
  if (!token || !isLoginConfigured()) return false;
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'senha-ok') return false;
  const expected = Buffer.from(sign(parts.slice(0, 3).join('.')));
  const received = Buffer.from(parts[3]);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false;
  return Number(parts[1]) > Date.now();
}
