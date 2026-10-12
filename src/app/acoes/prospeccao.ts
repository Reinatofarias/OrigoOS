'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { today } from '@/lib/dates';
import { normalizeWhatsapp, type Modelos } from '@/lib/prospeccao';
import { enviarParaTodos } from '@/lib/push';
import { quemPediu, registrar, vezesNaUltimaHora } from '@/lib/seguranca';

export async function salvarMensagens(form: FormData) {
  await requireAuth();
  const valor: Partial<Modelos> = {};
  for (const p of ['m1', 'm2', 'm3', 'm4'] as const) {
    const t = String(form.get(p) ?? '').trim();
    if (t) valor[p] = t.slice(0, 2000);
  }
  await db().from('settings').upsert({ chave: 'mensagens', valor, updated_at: new Date().toISOString() });
  revalidatePath('/', 'layout');
}

export async function restaurarMensagens() {
  await requireAuth();
  await db().from('settings').delete().eq('chave', 'mensagens');
  revalidatePath('/', 'layout');
}

const NICHOS = ['clima', 'adv', 'odonto', 'outro'];

// Formulário público (/f): quem preenche vira lead em "Respondeu" e o Renato recebe no celular.
export async function enviarContato(_: unknown, form: FormData): Promise<{ ok?: boolean; erro?: string } | null> {
  // Campo escondido: gente não vê, robô preenche.
  if (String(form.get('site') ?? '')) return { ok: true };
  const nome = String(form.get('nome') ?? '').trim().slice(0, 120);
  const empresa = String(form.get('empresa') ?? '').trim().slice(0, 120);
  const whatsapp = normalizeWhatsapp(String(form.get('whatsapp') ?? '').slice(0, 30));
  const cidade = String(form.get('cidade') ?? '').trim().slice(0, 80) || null;
  const recado = String(form.get('mensagem') ?? '').trim().slice(0, 1500) || null;
  const nicho = NICHOS.includes(String(form.get('nicho'))) ? String(form.get('nicho')) : 'outro';
  if (!nome || !whatsapp || whatsapp.length < 12 || whatsapp.length > 13) return { erro: 'Preencha seu nome e um WhatsApp com DDD.' };

  const supa = db();
  const quem = await quemPediu();
  if ((await vezesNaUltimaHora(supa, 'formulario', quem.ip)) >= 5) return { erro: 'Recebemos muitos envios daqui. Tente de novo mais tarde ou chame no WhatsApp.' };
  await registrar(supa, 'formulario', quem);

  const { data: last } = await supa.from('leads').select('ordem').order('ordem', { ascending: false }).limit(1);
  await supa.from('leads').insert({
    nome: empresa || nome,
    contato: empresa ? nome : null,
    whatsapp,
    whatsapp_confirmado: true,
    cidade,
    nicho,
    notas: recado ? `Pelo site: ${recado}` : 'Pediu contato pelo site.',
    status: 'respondeu',
    proxima_acao: today(),
    origem: 'site',
    ordem: (last?.[0]?.ordem ?? 0) + 1,
  });
  await enviarParaTodos(supa, { title: 'Novo lead pelo site!', body: `${empresa || nome}${cidade ? ` (${cidade})` : ''} pediu contato. Responda rápido: quem chama primeiro fecha.`, url: '/comercial' }).catch(() => null);
  revalidatePath('/', 'layout');
  return { ok: true };
}
