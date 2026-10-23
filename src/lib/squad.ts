import 'server-only';
import { randomBytes, timingSafeEqual } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { today } from './dates';
import type { Lead, Prioridade } from './db';
import { normalizeWhatsapp } from './prospeccao';
import { enviarParaTodos } from './push';

// Ponte com o Origo Squad (os agentes que rodam no computador do Renato).
// O squad lê clientes, leads e tarefas para não repetir nada, e manda de volta leads e tarefas.

export async function tokenSquad(supa: SupabaseClient) {
  const { data } = await supa.from('settings').select('valor').eq('chave', 'integracoes').maybeSingle();
  const atual = (data?.valor ?? {}) as { squad_token?: string };
  if (atual.squad_token) return atual.squad_token;
  const novo = randomBytes(24).toString('hex');
  await supa.from('settings').upsert({ chave: 'integracoes', valor: { ...atual, squad_token: novo } });
  return novo;
}

export async function squadAutorizado(supa: SupabaseClient, request: Request) {
  const { data } = await supa.from('settings').select('valor').eq('chave', 'integracoes').maybeSingle();
  const esperado = (data?.valor as { squad_token?: string } | null)?.squad_token;
  const recebido = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  return !!esperado && recebido.length === esperado.length && timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
}

export async function contextoSquad(supa: SupabaseClient) {
  const [clientes, leads, tarefas] = await Promise.all([
    supa.from('clients').select('nome, segmento, cidade, plataforma').eq('ativo', true).order('nome'),
    supa.from('leads').select('nome, cidade, nicho, status, whatsapp, instagram').order('updated_at', { ascending: false }).limit(300),
    supa.from('tasks').select('titulo, data, prioridade').neq('status', 'done').order('data', { ascending: true, nullsFirst: false }).limit(40),
  ]);
  return { clientes: clientes.data ?? [], leads: leads.data ?? [], tarefas: tarefas.data ?? [] };
}

type LeadDoSquad = { nome?: string; cidade?: string; nicho?: string; whatsapp?: string; instagram?: string; contato?: string; notas?: string };
type TarefaDoSquad = { titulo?: string; descricao?: string; data?: string; prioridade?: string; cliente?: string };

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '') || null;
const so = (v: string | null | undefined) => (v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// O agente escreve o nicho do jeito dele; aqui vira um dos 4 do funil.
function nichoDe(v: string | null): Lead['nicho'] {
  const t = so(v);
  if (/clima|arcondicionado|refriger/.test(t)) return 'clima';
  if (/adv|previdenci|juridic|direito/.test(t)) return 'adv';
  if (/odonto|dentist|dental|implante|ortodont/.test(t)) return 'odonto';
  return 'outro';
}

const PRIORIDADES: Prioridade[] = ['urgente', 'alta', 'normal', 'baixa'];

export async function receberDoSquad(supa: SupabaseClient, pacote: { leads?: LeadDoSquad[]; tarefas?: TarefaDoSquad[] }) {
  const hoje = today();
  const resultado = { leadsCriados: 0, leadsRepetidos: [] as string[], leadsSemContato: [] as string[], tarefasCriadas: 0 };

  const leads = Array.isArray(pacote.leads) ? pacote.leads.slice(0, 50) : [];
  if (leads.length) {
    const { data: existentes } = await supa.from('leads').select('nome, cidade, whatsapp, instagram');
    const zaps = new Set((existentes ?? []).map((l) => l.whatsapp).filter(Boolean));
    const instas = new Set((existentes ?? []).map((l) => so(l.instagram)).filter(Boolean));
    const nomes = new Set((existentes ?? []).map((l) => `${so(l.nome)}|${so(l.cidade)}`));
    const { data: ultimo } = await supa.from('leads').select('ordem').order('ordem', { ascending: false }).limit(1);
    let ordem = ultimo?.[0]?.ordem ?? 0;
    const novos = [];
    for (const l of leads) {
      const nome = texto(l.nome, 120);
      if (!nome) continue;
      const cidade = texto(l.cidade, 80);
      const digitos = normalizeWhatsapp(String(l.whatsapp ?? '').slice(0, 30));
      const whatsapp = digitos && digitos.length >= 12 && digitos.length <= 13 ? digitos : null;
      const instagram = texto(l.instagram, 80)?.replace(/^@|^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '') || null;
      // Regra do Renato: lead sem WhatsApp e sem Instagram não entra.
      if (!whatsapp && !instagram) {
        resultado.leadsSemContato.push(nome);
        continue;
      }
      const chave = `${so(nome)}|${so(cidade)}`;
      if ((whatsapp && zaps.has(whatsapp)) || (instagram && instas.has(so(instagram))) || nomes.has(chave)) {
        resultado.leadsRepetidos.push(nome);
        continue;
      }
      if (whatsapp) zaps.add(whatsapp);
      if (instagram) instas.add(so(instagram));
      nomes.add(chave);
      novos.push({
        nome,
        cidade,
        nicho: nichoDe(texto(l.nicho, 60)),
        whatsapp,
        instagram,
        contato: texto(l.contato, 80),
        notas: [`Trazido pelo Origo Squad em ${hoje}.`, texto(l.notas, 2000)].filter(Boolean).join('\n'),
        status: 'novo',
        proxima_acao: hoje,
        origem: 'squad',
        ordem: ++ordem,
      });
    }
    if (novos.length) {
      const { error } = await supa.from('leads').insert(novos);
      if (error) throw new Error(`leads: ${error.message}`);
      resultado.leadsCriados = novos.length;
    }
  }

  const tarefas = Array.isArray(pacote.tarefas) ? pacote.tarefas.slice(0, 30) : [];
  if (tarefas.length) {
    const { data: clientes } = await supa.from('clients').select('id, nome').eq('ativo', true);
    const linhas = [];
    for (const t of tarefas) {
      const titulo = texto(t.titulo, 300);
      if (!titulo) continue;
      const data = typeof t.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.data) ? t.data : null;
      const prioridade = PRIORIDADES.includes(t.prioridade as Prioridade) ? (t.prioridade as Prioridade) : 'normal';
      const cliente = so(t.cliente);
      const client_id = cliente ? (clientes ?? []).find((c) => so(c.nome).includes(cliente) || cliente.includes(so(c.nome)))?.id ?? null : null;
      linhas.push({ titulo, descricao: ['Criada pelo Origo Squad.', texto(t.descricao, 4000)].filter(Boolean).join('\n\n'), data, prioridade, client_id, status: 'todo' });
    }
    if (linhas.length) {
      const { error } = await supa.from('tasks').insert(linhas);
      if (error) throw new Error(`tarefas: ${error.message}`);
      resultado.tarefasCriadas = linhas.length;
    }
  }

  const partes = [
    resultado.leadsCriados ? `${resultado.leadsCriados} lead(s) novo(s) no funil` : '',
    resultado.tarefasCriadas ? `${resultado.tarefasCriadas} tarefa(s)` : '',
  ].filter(Boolean);
  if (partes.length) {
    await enviarParaTodos(supa, { title: 'O squad mandou trabalho', body: `${partes.join(' e ')}.`, url: resultado.leadsCriados ? '/comercial' : '/tarefas' }).catch(() => null);
  }
  return resultado;
}
