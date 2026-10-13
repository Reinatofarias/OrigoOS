import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { addMonths, formatMonth } from './dates';
import { brl } from './format';
import { somaDoMes } from './anuncios';
import { metricas, variacao } from './relatorio';
import { enviarParaTodos } from './push';

const pct = (v: number | null) => (v === null ? '' : ` (${v > 0 ? '+' : ''}${Math.round(v)}% vs mês anterior)`);

// Rascunho de destaques a partir dos números: o Renato só revisa e ajusta.
function destaquesAuto(atual: ReturnType<typeof metricas>, antes: ReturnType<typeof metricas> | null, nomeConv: string) {
  const linhas: string[] = [];
  if (atual.investimento !== null) linhas.push(`Investimento de ${brl(atual.investimento)}${pct(variacao(atual.investimento, antes?.investimento))}.`);
  if (atual.conversoes !== null) linhas.push(`${Math.round(atual.conversoes)} ${nomeConv.toLowerCase()}${pct(variacao(atual.conversoes, antes?.conversoes))}.`);
  if (atual.cpa !== null) linhas.push(`Custo por ${nomeConv.toLowerCase().replace(/s$/, '')}: ${brl(atual.cpa)}${pct(variacao(atual.cpa, antes?.cpa))}.`);
  if (atual.ctr !== null) linhas.push(`Taxa de cliques (CTR) de ${atual.ctr.toFixed(2).replace('.', ',')}%.`);
  return linhas.length ? linhas.join('\n') : null;
}

// Todo dia (cron da madrugada): garante o rascunho do relatório do mês passado de cada cliente ativo,
// já com os números do Meta/Google. Não mexe em relatório já enviado nem em números que o Renato editou.
export async function rascunhosDoMesPassado(supa: SupabaseClient, hoje: string) {
  const competencia = addMonths(hoje.slice(0, 7), -1);
  const anterior = addMonths(competencia, -1);
  const [{ data: clientes }, { data: existentes }, { data: antigos }] = await Promise.all([
    supa.from('clients').select('id, nome, inicio, created_at').eq('ativo', true),
    supa.from('reports').select('id, client_id, status, investimento, destaques').eq('competencia', competencia),
    supa.from('reports').select('client_id, investimento, impressoes, cliques, conversoes, conversao_nome').eq('competencia', anterior),
  ]);
  let criados = 0;
  let preenchidos = 0;
  for (const c of clientes ?? []) {
    const desde = (c.inicio ?? c.created_at.slice(0, 10)).slice(0, 7);
    if (desde > competencia) continue;
    const existe = (existentes ?? []).find((r) => r.client_id === c.id);
    if (existe && (existe.status === 'enviado' || existe.investimento !== null)) continue;
    const soma = await somaDoMes(supa, c.id, competencia);
    const velho = (antigos ?? []).find((r) => r.client_id === c.id);
    const nomeConv = velho?.conversao_nome ?? 'Contatos';
    const numeros = soma.tem ? soma.total : null;
    const destaques = numeros ? destaquesAuto(metricas(numeros), velho ? metricas(velho) : null, nomeConv) : null;
    if (existe) {
      if (!numeros) continue;
      await supa.from('reports').update({ ...numeros, destaques: existe.destaques || destaques, updated_at: new Date().toISOString() }).eq('id', existe.id);
      preenchidos++;
    } else {
      await supa.from('reports').insert({ client_id: c.id, competencia, conversao_nome: nomeConv, ...(numeros ?? {}), destaques });
      criados++;
    }
  }
  if (criados) {
    await enviarParaTodos(supa, {
      title: `Relatórios de ${formatMonth(competencia)} prontos 📊`,
      body: `${criados} rascunho${criados > 1 ? 's' : ''} com os números do mês. É só revisar e mandar pro cliente.`,
      url: '/clientes',
      tag: `relatorios-${competencia}`,
    }).catch(() => null);
  }
  return { competencia, criados, preenchidos };
}
