import 'server-only';
import { randomBytes, timingSafeEqual } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { TZ, addDays, today, weekday } from './dates';
import { brl } from './format';
import { enviarParaTodos, resumoDoDia, type Aviso } from './push';
import { hora, listarEventos, situacaoAgenda } from './google-agenda';
import { saudeDosClientes } from './saude';
import { garantirRecorrentes } from './modelos';

// Notificações no celular. Um relógio no Supabase (pg_cron) chama /api/avisos de 5 em 5 minutos;
// a cada chamada o sistema vê o que está na hora de avisar. Cada aviso tem uma chave e só sai uma vez
// (tabela avisos_enviados).

export type Preferencias = {
  resumo: boolean; // 7h51, seg a sex
  agenda: boolean;
  antecedencia: number; // minutos antes do compromisso
  tarefas: boolean; // 16h30, o que ainda falta do dia
  prospeccao: boolean; // 13h25, contatos do dia
  financeiro: boolean; // 9h, cobranças vencendo e vencidas
  pagamentos: boolean; // na hora em que o Asaas confirma
  saude: boolean; // quando um cliente entra em risco
  silencio_de: string; // não incomoda entre esses horários
  silencio_ate: string;
};

export const PADRAO: Preferencias = {
  resumo: true,
  agenda: true,
  antecedencia: 15,
  tarefas: true,
  prospeccao: true,
  financeiro: true,
  pagamentos: true,
  saude: true,
  silencio_de: '21:00',
  silencio_ate: '06:30',
};

export async function lerPreferencias(supa: SupabaseClient): Promise<Preferencias> {
  const { data } = await supa.from('settings').select('valor').eq('chave', 'avisos').maybeSingle();
  return { ...PADRAO, ...((data?.valor as Partial<Preferencias>) ?? {}) };
}

export async function salvarPreferencias(supa: SupabaseClient, p: Preferencias) {
  await supa.from('settings').upsert({ chave: 'avisos', valor: p });
}

// Endereço e senha que o relógio do Supabase usa pra chamar o sistema. Criados na primeira vez que a tela abre.
export async function relogio(supa: SupabaseClient, origem: string) {
  // Na Vercel, usa sempre o endereço de produção (nunca o de uma prévia de PR).
  const producao = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const url = `${producao ? `https://${producao}` : origem}/api/avisos`;
  const { data } = await supa.from('settings').select('valor').eq('chave', 'avisos_relogio').maybeSingle();
  const atual = data?.valor as { url: string; token: string } | null;
  if (atual?.token && atual.url === url) return atual;
  const novo = { url, token: atual?.token ?? randomBytes(24).toString('hex') };
  await supa.from('settings').upsert({ chave: 'avisos_relogio', valor: novo });
  return novo;
}

// O relógio roda de 5 em 5 minutos; 20 sem notícia é sinal de que parou.
export const relogioRodando = (ultimo: { em: string } | null) => !!ultimo && Date.now() - new Date(ultimo.em).getTime() < 20 * 60_000;

export async function relogioAutorizado(supa: SupabaseClient, request: Request) {
  const recebido = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  const { data } = await supa.from('settings').select('valor').eq('chave', 'avisos_relogio').maybeSingle();
  const esperado = (data?.valor as { token?: string } | null)?.token;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Hora atual em Recife, "HH:MM".
export function agoraHHMM(d = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

const entre = (h: string, de: string, ate: string) => (de <= ate ? h >= de && h < ate : h >= de || h < ate);

// Manda uma vez só. Devolve false se essa chave já tinha saído (ou se a tabela da v8 não existe).
async function avisarUmaVez(supa: SupabaseClient, chave: string, aviso: Aviso) {
  const { error } = await supa.from('avisos_enviados').insert({ chave });
  if (error) return false;
  await enviarParaTodos(supa, { ...aviso, tag: chave });
  return true;
}

export async function avisarPagamento(supa: SupabaseClient, chargeId: string) {
  const p = await lerPreferencias(supa);
  if (!p.pagamentos) return;
  const { data: c } = await supa.from('charges').select('valor, descricao, clients(nome)').eq('id', chargeId).maybeSingle();
  if (!c) return;
  const nome = (c.clients as unknown as { nome: string } | null)?.nome ?? 'Cliente';
  await avisarUmaVez(supa, `pago:${chargeId}`, { title: `💰 Pagamento recebido: ${brl(c.valor)}`, body: `${nome} · ${c.descricao}`, url: '/financeiro' });
}

// O resumo das 7h51 (também chamado pela Vercel Cron em /api/lembrete).
export async function avisarResumo(supa: SupabaseClient, hoje = today()) {
  if (!(await lerPreferencias(supa)).resumo) return false;
  const { error } = await supa.from('avisos_enviados').insert({ chave: `resumo:${hoje}` });
  // Sem a tabela da v8, continua valendo a trava antiga (um por dia).
  if (error && error.code !== '42P01') return false;
  if (error) {
    const { data: ultimo } = await supa.from('settings').select('valor').eq('chave', 'lembrete_ultimo').maybeSingle();
    if (ultimo?.valor === hoje) return false;
    await supa.from('settings').upsert({ chave: 'lembrete_ultimo', valor: hoje });
  }
  await garantirRecorrentes(supa);
  await enviarParaTodos(supa, { ...(await resumoDoDia(supa)), tag: `resumo:${hoje}` });
  return true;
}

// Uma volta do relógio: confere cada tipo de aviso.
export async function rodarAvisos(supa: SupabaseClient, agora = new Date()) {
  const p = await lerPreferencias(supa);
  const hoje = today();
  const h = agoraHHMM(agora);
  const util = weekday(hoje) >= 1 && weekday(hoje) <= 5;
  const enviados: string[] = [];
  await supa.from('settings').upsert({ chave: 'avisos_ultimo', valor: { em: agora.toISOString() } });
  // Limpeza: guarda só 45 dias de histórico.
  if (h >= '03:00' && h < '03:05') await supa.from('avisos_enviados').delete().lt('enviado_em', new Date(agora.getTime() - 45 * 86_400_000).toISOString());
  if (entre(h, p.silencio_de, p.silencio_ate)) return { enviados, silencio: true };

  const tentar = async (nome: string, f: () => Promise<boolean | void>) => {
    try {
      if (await f()) enviados.push(nome);
    } catch (e) {
      console.error(`avisos/${nome}:`, e);
    }
  };

  if (p.resumo && util && h >= '07:51' && h < '11:00') await tentar('resumo', () => avisarResumo(supa, hoje));

  if (p.agenda && p.antecedencia > 0) {
    await tentar('agenda', async () => {
      const s = await situacaoAgenda(supa);
      if (!s.ve) return false;
      const ate = new Date(agora.getTime() + p.antecedencia * 60_000);
      const dias = [hoje, ...(today() !== new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(ate) ? [addDays(hoje, 1)] : [])];
      const eventos = await listarEventos(supa, dias[0], dias[dias.length - 1]);
      let algum = false;
      for (const e of eventos) {
        if (e.diaInteiro) continue;
        const ini = new Date(e.inicio).getTime();
        if (ini <= agora.getTime() || ini > ate.getTime()) continue;
        const min = Math.max(1, Math.round((ini - agora.getTime()) / 60_000));
        const ok = await avisarUmaVez(supa, `agenda:${e.id}:${e.inicio}`, {
          title: `Em ${min} min: ${e.titulo}`,
          body: [`${hora(e.inicio)} – ${hora(e.fim)}`, e.local, e.meet ? 'Toque pra entrar no Meet' : null].filter(Boolean).join(' · '),
          url: e.meet ?? '/agenda',
        });
        algum ||= ok;
      }
      return algum;
    });
  }

  if (p.prospeccao && util && h >= '13:25' && h < '17:00') {
    await tentar('prospeccao', async () => {
      const [{ data: fu }, { data: novos }] = await Promise.all([
        supa.from('leads').select('nome').in('status', ['m1', 'm2', 'm3', 'respondeu', 'call', 'proposta']).lte('proxima_acao', hoje),
        supa.from('leads').select('nome').eq('status', 'novo').limit(5),
      ]);
      const total = (fu?.length ?? 0) + (novos?.length ?? 0);
      if (!total) return false;
      return avisarUmaVez(supa, `prospeccao:${hoje}`, {
        title: `Hora da prospecção: ${total} contato${total > 1 ? 's' : ''}`,
        body: [fu?.length ? `${fu.length} follow-up${fu.length > 1 ? 's' : ''}` : null, novos?.length ? `${novos.length} lead${novos.length > 1 ? 's' : ''} novo${novos.length > 1 ? 's' : ''}` : null].filter(Boolean).join(' · '),
        url: '/',
      });
    });
  }

  if (p.tarefas && util && h >= '16:30' && h < '20:00') {
    await tentar('tarefas', async () => {
      const { data } = await supa.from('tasks').select('titulo, data').neq('status', 'done').lte('data', hoje).order('data');
      const ts = data ?? [];
      if (!ts.length) return false;
      const atrasadas = ts.filter((t) => t.data! < hoje).length;
      return avisarUmaVez(supa, `tarefas:${hoje}`, {
        title: `Faltam ${ts.length} tarefa${ts.length > 1 ? 's' : ''} hoje${atrasadas ? ` (${atrasadas} atrasada${atrasadas > 1 ? 's' : ''})` : ''}`,
        body: ts.slice(0, 3).map((t) => `• ${t.titulo}`).join('\n'),
        url: '/tarefas',
      });
    });
  }

  if (p.financeiro && h >= '09:00' && h < '18:00') {
    await tentar('financeiro', async () => {
      const { data } = await supa.from('charges').select('valor, vencimento, clients(nome)').eq('status', 'pendente').lte('vencimento', hoje).order('vencimento');
      const cs = (data ?? []) as unknown as { valor: number; vencimento: string; clients: { nome: string } | null }[];
      if (!cs.length) return false;
      const vencidas = cs.filter((c) => c.vencimento < hoje);
      const total = cs.reduce((s, c) => s + Number(c.valor), 0);
      return avisarUmaVez(supa, `financeiro:${hoje}`, {
        title: vencidas.length ? `${vencidas.length} cobrança${vencidas.length > 1 ? 's' : ''} vencida${vencidas.length > 1 ? 's' : ''} · ${brl(total, false)}` : `Vence hoje: ${brl(total, false)}`,
        body: cs.slice(0, 4).map((c) => `${c.clients?.nome ?? 'Cliente'}: ${brl(c.valor)}${c.vencimento < hoje ? ' (vencida)' : ''}`).join('\n'),
        url: '/financeiro',
      });
    });
  }

  if (p.saude && h >= '09:05' && h < '18:00') {
    await tentar('saude', async () => {
      // Avisa quando um cliente entra em risco (não repete todo dia; volta a avisar se ele sair e entrar de novo).
      const risco = (await saudeDosClientes(supa, hoje)).filter((c) => c.nivel === 'risco');
      const { data } = await supa.from('settings').select('valor').eq('chave', 'avisos_saude').maybeSingle();
      const antes = new Set<string>((data?.valor as string[] | null) ?? []);
      await supa.from('settings').upsert({ chave: 'avisos_saude', valor: risco.map((c) => c.client_id) });
      const novos = risco.filter((c) => !antes.has(c.client_id));
      if (!novos.length) return false;
      const um = novos.length === 1 ? novos[0] : null;
      return avisarUmaVez(supa, `saude:${hoje}:${novos.map((c) => c.client_id).sort().join(',')}`, {
        title: um ? `Cliente em risco: ${um.nome}` : `${novos.length} clientes entraram em risco`,
        body: um ? um.alertas.filter((a) => a.nivel === 'risco').map((a) => a.texto).join('\n') : novos.map((c) => `${c.nome}: ${c.alertas.find((a) => a.nivel === 'risco')?.texto ?? ''}`).join('\n'),
        url: um ? `/clientes/${um.client_id}` : '/clientes',
      });
    });
  }

  return { enviados, silencio: false };
}
