import 'server-only';
import { randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays, monthRange, today } from './dates';

// Números das campanhas: o Meta vem pela API (token na Vercel), o Google chega pelo script do Google Ads.

export type DiaAnuncio = { data: string; investimento: number; impressoes: number; cliques: number; conversoes: number };
export type Numeros = { investimento: number; impressoes: number; cliques: number; conversoes: number };

export const so = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '');

// Conversões do Meta que contam como "contato": conversas no WhatsApp/Direct e leads (formulário e site).
export const CONVERSOES_META_PADRAO = ['onsite_conversion.messaging_conversation_started_7d', 'lead'];

const VERSAO_META = () => process.env.META_API_VERSION?.trim() || 'v23.0';
export const metaConfigurado = () => !!process.env.META_ACCESS_TOKEN?.trim();

type LinhaMeta = { date_start: string; spend?: string; impressions?: string; clicks?: string; actions?: { action_type: string; value: string }[] };

async function buscarMeta(conta: string, desde: string, ate: string, base = 'https://graph.facebook.com') {
  const token = process.env.META_ACCESS_TOKEN!.trim();
  const params = new URLSearchParams({
    fields: 'spend,impressions,clicks,actions',
    level: 'account',
    time_increment: '1',
    time_range: JSON.stringify({ since: desde, until: ate }),
    limit: '100',
    access_token: token,
  });
  let url: string | null = `${process.env.META_BASE_URL?.trim() || base}/${VERSAO_META()}/act_${conta}/insights?${params}`;
  const linhas: LinhaMeta[] = [];
  while (url) {
    const r = await fetch(url, { cache: 'no-store' });
    const j = (await r.json().catch(() => null)) as { data?: LinhaMeta[]; paging?: { next?: string }; error?: { message?: string } } | null;
    if (!r.ok || !j?.data) throw new Error(j?.error?.message ?? `Meta respondeu ${r.status}`);
    linhas.push(...j.data);
    url = j.paging?.next ?? null;
  }
  return linhas;
}

// Puxa os últimos dias de todas as contas do Meta ligadas a clientes ativos.
export async function sincronizarMeta(supa: SupabaseClient, dias = 7) {
  if (!metaConfigurado()) return { contas: 0, dias: 0, erros: ['META_ACCESS_TOKEN não configurado na Vercel.'] };
  const { data: clientes } = await supa.from('clients').select('id, nome, meta_conta, meta_conversoes').eq('ativo', true).not('meta_conta', 'is', null);
  const ate = addDays(today(), -1);
  const desde = addDays(ate, -(dias - 1));
  let total = 0;
  const erros: string[] = [];
  for (const c of clientes ?? []) {
    const conta = so(c.meta_conta);
    if (!conta) continue;
    const tipos = (c.meta_conversoes as string | null)?.split(',').map((t) => t.trim()).filter(Boolean) ?? CONVERSOES_META_PADRAO;
    try {
      const linhas = await buscarMeta(conta, desde, ate);
      const porDia = new Map(linhas.map((l) => [l.date_start, l]));
      // Dia sem linha = anúncio sem gasto. Grava zero pra saúde do cliente saber que parou.
      const registros = [];
      for (let d = desde; d <= ate; d = addDays(d, 1)) {
        const l = porDia.get(d);
        registros.push({
          client_id: c.id,
          plataforma: 'meta',
          data: d,
          investimento: Number(l?.spend ?? 0),
          impressoes: Number(l?.impressions ?? 0),
          cliques: Number(l?.clicks ?? 0),
          conversoes: (l?.actions ?? []).filter((a) => tipos.includes(a.action_type)).reduce((s, a) => s + Number(a.value), 0),
          atualizado_em: new Date().toISOString(),
        });
      }
      await supa.from('ad_metrics').upsert(registros);
      total += registros.length;
    } catch (e) {
      erros.push(`${c.nome}: ${(e as Error).message}`);
    }
  }
  return { contas: clientes?.length ?? 0, dias: total, erros };
}

// Dados que o script do Google Ads manda todo dia.
export type PacoteGoogle = { contas?: { conta?: string; nome?: string; dias?: Partial<DiaAnuncio>[] }[] };

export async function receberGoogle(supa: SupabaseClient, pacote: PacoteGoogle) {
  const { data: clientes } = await supa.from('clients').select('id, google_conta').not('google_conta', 'is', null);
  const porConta = new Map((clientes ?? []).map((c) => [so(c.google_conta), c.id as string]));
  const semCliente: string[] = [];
  let total = 0;
  for (const conta of (pacote.contas ?? []).slice(0, 100)) {
    const id = porConta.get(so(conta.conta));
    if (!id) {
      semCliente.push(`${conta.nome ?? ''} (${conta.conta ?? '?'})`.trim());
      continue;
    }
    const registros = (conta.dias ?? [])
      .filter((d) => typeof d.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.data))
      .slice(0, 400)
      .map((d) => ({
        client_id: id,
        plataforma: 'google',
        data: d.data!,
        investimento: Math.round(Number(d.investimento ?? 0) * 100) / 100 || 0,
        impressoes: Math.round(Number(d.impressoes ?? 0)) || 0,
        cliques: Math.round(Number(d.cliques ?? 0)) || 0,
        conversoes: Math.round(Number(d.conversoes ?? 0) * 100) / 100 || 0,
        atualizado_em: new Date().toISOString(),
      }));
    if (registros.length) await supa.from('ad_metrics').upsert(registros);
    total += registros.length;
  }
  await supa.from('settings').upsert({ chave: 'google_ultimo', valor: { em: new Date().toISOString(), dias: total, sem_cliente: semCliente } });
  return { dias: total, semCliente };
}

export async function tokenGoogle(supa: SupabaseClient) {
  const { data } = await supa.from('settings').select('valor').eq('chave', 'integracoes').maybeSingle();
  const atual = (data?.valor ?? {}) as { google_token?: string };
  if (atual.google_token) return atual.google_token;
  const novo = randomBytes(24).toString('hex');
  await supa.from('settings').upsert({ chave: 'integracoes', valor: { ...atual, google_token: novo } });
  return novo;
}

const vazio = (): Numeros => ({ investimento: 0, impressoes: 0, cliques: 0, conversoes: 0 });

// Soma de um período, Google + Meta.
export async function somaDoPeriodo(supa: SupabaseClient, clientId: string, desde: string, ate: string) {
  const { data } = await supa.from('ad_metrics').select('plataforma, investimento, impressoes, cliques, conversoes').eq('client_id', clientId).gte('data', desde).lte('data', ate);
  const total = vazio();
  const plataformas = new Set<string>();
  for (const d of data ?? []) {
    plataformas.add(d.plataforma);
    total.investimento += Number(d.investimento);
    total.impressoes += Number(d.impressoes);
    total.cliques += Number(d.cliques);
    total.conversoes += Number(d.conversoes);
  }
  total.investimento = Math.round(total.investimento * 100) / 100;
  total.conversoes = Math.round(total.conversoes);
  return { total, plataformas: [...plataformas], tem: (data?.length ?? 0) > 0 };
}

export async function somaDoMes(supa: SupabaseClient, clientId: string, competencia: string) {
  const { start, end } = monthRange(competencia);
  return somaDoPeriodo(supa, clientId, start, end);
}
