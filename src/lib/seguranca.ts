import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { headers } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

export type Seguranca = { sessao_versao: number; totp_ativo: boolean; totp_secret?: string | null; totp_pendente?: string | null };

export async function lerSeguranca(supa: SupabaseClient): Promise<Seguranca> {
  const { data } = await supa.from('settings').select('valor').eq('chave', 'seguranca').maybeSingle();
  return { sessao_versao: 1, totp_ativo: false, ...((data?.valor as Partial<Seguranca>) ?? {}) };
}

export async function salvarSeguranca(supa: SupabaseClient, campos: Partial<Seguranca>) {
  const atual = await lerSeguranca(supa);
  await supa.from('settings').upsert({ chave: 'seguranca', valor: { ...atual, ...campos }, updated_at: new Date().toISOString() });
}

// IP e navegador de quem fez o pedido (a Vercel manda o IP real em x-forwarded-for).
export async function quemPediu() {
  const h = await headers();
  return {
    ip: (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'desconhecido',
    navegador: (h.get('user-agent') ?? '').slice(0, 300),
  };
}

export async function registrar(supa: SupabaseClient, evento: string, extra: { ip?: string; navegador?: string; aparelho?: string | null } = {}) {
  await supa.from('access_log').insert({ evento, ip: extra.ip ?? null, navegador: extra.navegador ?? null, aparelho: extra.aparelho ?? null });
}

const JANELA_MIN = 15;

// Trava o login depois de 5 erros do mesmo IP (ou 30 no total) em 15 minutos.
export async function loginTravado(supa: SupabaseClient, ip: string) {
  const desde = new Date(Date.now() - JANELA_MIN * 60_000).toISOString();
  const [{ count: doIp }, { count: geral }] = await Promise.all([
    supa.from('access_log').select('id', { count: 'exact', head: true }).eq('evento', 'login_falhou').eq('ip', ip).gte('created_at', desde),
    supa.from('access_log').select('id', { count: 'exact', head: true }).eq('evento', 'login_falhou').gte('created_at', desde),
  ]);
  return (doIp ?? 0) >= 5 || (geral ?? 0) >= 30;
}

// Quantas vezes este IP fez um evento na última hora (limite do formulário público).
export async function vezesNaUltimaHora(supa: SupabaseClient, evento: string, ip: string) {
  const desde = new Date(Date.now() - 60 * 60_000).toISOString();
  const { count } = await supa.from('access_log').select('id', { count: 'exact', head: true }).eq('evento', evento).eq('ip', ip).gte('created_at', desde);
  return count ?? 0;
}

// Nome curto do aparelho a partir do navegador ("iPhone · Safari").
export function nomeDoAparelho(ua: string | null) {
  const u = ua ?? '';
  const so = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Mac OS X/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : /Linux/.test(u) ? 'Linux' : 'Aparelho';
  const nav = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Chrome\//.test(u) ? 'Chrome' : /Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : 'navegador';
  return `${so} · ${nav}`;
}

// ---------- Código do app autenticador (TOTP, RFC 6238) ----------

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function novoSegredo() {
  const bytes = randomBytes(20);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  return bits.match(/.{1,5}/g)!.map((c) => B32[parseInt(c.padEnd(5, '0'), 2)]).join('');
}

function base32(segredo: string) {
  let bits = '';
  for (const c of segredo.replace(/=+$/, '').toUpperCase()) {
    const v = B32.indexOf(c);
    if (v >= 0) bits += v.toString(2).padStart(5, '0');
  }
  return Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
}

export function codigoTotp(segredo: string, momento = Date.now()) {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(momento / 30_000)));
  const h = createHmac('sha1', base32(segredo)).update(contador).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

// Aceita o código atual e o de 30 segundos antes ou depois (relógio do celular adiantado ou atrasado).
export function codigoValido(segredo: string | null | undefined, codigo: unknown) {
  const c = String(codigo ?? '').replace(/\D/g, '');
  if (!segredo || c.length !== 6) return false;
  return [-1, 0, 1].some((d) => timingSafeEqual(Buffer.from(codigoTotp(segredo, Date.now() + d * 30_000)), Buffer.from(c)));
}

export function linkAutenticador(segredo: string) {
  return `otpauth://totp/Origo%20OS:Renato?secret=${segredo}&issuer=Origo%20OS&algorithm=SHA1&digits=6&period=30`;
}
