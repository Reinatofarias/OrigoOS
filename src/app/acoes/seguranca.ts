'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import QRCode from 'qrcode';
import { requireAuth } from '@/lib/auth';
import { esquecerVersao } from '@/lib/sessao';
import { db } from '@/lib/db';
import { codigoValido, lerSeguranca, linkAutenticador, novoSegredo, quemPediu, registrar, salvarSeguranca } from '@/lib/seguranca';

// Derruba a sessão de todos os aparelhos (inclusive este).
export async function sairDeTodos() {
  await requireAuth();
  const supa = db();
  const seg = await lerSeguranca(supa);
  await salvarSeguranca(supa, { sessao_versao: seg.sessao_versao + 1 });
  esquecerVersao();
  await registrar(supa, 'sair_todos', await quemPediu());
  redirect('/login');
}

// Passo 1: gera o segredo e o QR Code pra escanear no Google Authenticator (ainda não liga).
export async function iniciarAutenticador() {
  await requireAuth();
  const supa = db();
  const segredo = novoSegredo();
  await salvarSeguranca(supa, { totp_pendente: segredo });
  const qr = await QRCode.toDataURL(linkAutenticador(segredo), { margin: 1, width: 220 });
  return { segredo, qr };
}

// Passo 2: só liga depois de digitar um código certo, pra ninguém ficar trancado pra fora.
export async function confirmarAutenticador(codigo: string) {
  await requireAuth();
  const supa = db();
  const seg = await lerSeguranca(supa);
  if (!codigoValido(seg.totp_pendente, codigo)) return { erro: 'Código errado. Confira se o relógio do celular está certo e tente o código novo.' };
  await salvarSeguranca(supa, { totp_ativo: true, totp_secret: seg.totp_pendente, totp_pendente: null });
  await registrar(supa, 'autenticador_ligado', await quemPediu());
  revalidatePath('/configuracoes');
  return { ok: true };
}

export async function desligarAutenticador(codigo: string) {
  await requireAuth();
  const supa = db();
  const seg = await lerSeguranca(supa);
  if (!codigoValido(seg.totp_secret, codigo)) return { erro: 'Código errado.' };
  await salvarSeguranca(supa, { totp_ativo: false, totp_secret: null, totp_pendente: null });
  await registrar(supa, 'autenticador_desligado', await quemPediu());
  revalidatePath('/configuracoes');
  return { ok: true };
}
