'use client';

import { useState, useTransition } from 'react';
import { BriefcaseBusiness, GraduationCap, Megaphone } from 'lucide-react';
import type { ItemProposta, ModeloContrato, Rede, Service, TipoContrato } from '@/lib/db';
import { REDES, TIPOS, VIGENCIAS } from '@/lib/contrato';
import { brl } from '@/lib/format';
import { btn } from './ui';
import { Field } from './dialog';

type Cliente = { id: string; nome: string; mensalidade: number | null; dia_vencimento: number; plataforma: string };

const ICONE: Record<TipoContrato, React.ReactNode> = {
  trafego: <Megaphone size={18} />,
  mentoria: <GraduationCap size={18} />,
  servicos: <BriefcaseBusiness size={18} />,
};

// Serviço de tráfego que combina com as redes marcadas (Google, Meta ou os dois).
function trafegoDasRedes(servicos: Service[], redes: Rede[]) {
  const g = redes.includes('google') || redes.includes('youtube');
  const m = redes.includes('meta');
  const alvo = g && m ? 'google_meta' : m ? 'meta' : g ? 'google' : null;
  return alvo ? servicos.find((s) => s.plataforma === alvo && /tr[aá]fego/i.test(s.nome)) : undefined;
}

const ehTrafego = (s: Service) => !!s.plataforma && /tr[aá]fego/i.test(s.nome);

// Escolhas do contrato antes de mandar pro cliente: tipo, redes, serviços, prazo e condição de entrada.
export function ContratoEscolhas({
  servicos,
  clientes,
  clienteInicial,
  inicial,
  acao,
  botao,
}: {
  servicos: Service[];
  clientes?: Cliente[];
  clienteInicial?: string;
  inicial?: { modelo: ModeloContrato; itens: ItemProposta[]; dia_vencimento: number };
  acao: (fd: FormData) => Promise<{ erro?: string } | void>;
  botao: string;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [cliente, setCliente] = useState(clienteInicial ?? '');
  const [tipo, setTipo] = useState<TipoContrato>(inicial?.modelo.tipo ?? 'trafego');
  const [redes, setRedes] = useState<Rede[]>(inicial?.modelo.redes ?? ['meta']);
  const outroInicial = inicial?.itens.find((i) => !i.service_id);
  const [marcados, setMarcados] = useState<Record<string, number>>(() => {
    if (inicial) return Object.fromEntries(inicial.itens.filter((i) => i.service_id).map((i) => [i.service_id!, Number(i.valor)]));
    const t = trafegoDasRedes(servicos, ['meta']);
    return t ? { [t.id]: Number(t.preco) } : {};
  });
  const [promo, setPromo] = useState(!!inicial?.modelo.promo_valor);
  const sel = clientes?.find((c) => c.id === cliente);

  // Ao trocar tipo ou redes, já marca o serviço que combina (dá pra desmarcar depois).
  function sugerir(t: TipoContrato, rs: Rede[]) {
    setMarcados((atual) => {
      const sem = Object.fromEntries(Object.entries(atual).filter(([id]) => !servicos.find((s) => s.id === id && ehTrafego(s))));
      if (t === 'trafego') {
        const s = trafegoDasRedes(servicos, rs);
        if (s) sem[s.id] = sel?.mensalidade && Number(sel.mensalidade) > 0 ? Number(sel.mensalidade) : Number(s.preco);
      }
      if (t === 'mentoria' && !Object.keys(sem).length) {
        const s = servicos.find((x) => /mentoria/i.test(x.nome));
        if (s) sem[s.id] = Number(s.preco);
      }
      return sem;
    });
  }

  const total = Object.entries(marcados).reduce(
    (acc, [id, v]) => {
      const s = servicos.find((x) => x.id === id);
      if (s?.cobranca === 'unico') acc.unico += v;
      else acc.mensal += v;
      return acc;
    },
    { mensal: 0, unico: 0 },
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setErro(null);
        setOk(false);
        start(async () => {
          const r = await acao(fd);
          if (r?.erro) setErro(r.erro);
          else setOk(true);
        });
      }}
      className="grid gap-5"
    >
      {clientes && (
        <section className="grid gap-2">
          <h3 className="text-[13.5px] font-semibold">1. Pra quem é</h3>
          <select name="client_id" required value={cliente} onChange={(e) => setCliente(e.target.value)} className="field">
            <option value="" disabled>
              Escolha o cliente
            </option>
            <option value="novo">Cliente novo (ele preenche os dados no link)</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          {cliente === 'novo' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome do cliente ou da empresa *">
                <input name="novo_nome" required className="field" placeholder="Ex.: Clínica Sorriso" />
              </Field>
              <Field label="WhatsApp (pra mandar o link)">
                <input name="novo_whatsapp" inputMode="tel" className="field" placeholder="(81) 9 9999-9999" />
              </Field>
            </div>
          )}
        </section>
      )}

      <section className="grid gap-2">
        <h3 className="text-[13.5px] font-semibold">{clientes ? '2. ' : ''}Tipo de contrato</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(TIPOS) as TipoContrato[]).map((t) => (
            <label key={t} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${tipo === t ? 'border-brand bg-brand-soft ring-1 ring-brand/30' : 'border-line hover:bg-surface-2'}`}>
              <input
                type="radio"
                name="tipo"
                value={t}
                checked={tipo === t}
                onChange={() => {
                  setTipo(t);
                  sugerir(t, redes);
                }}
                className="sr-only"
              />
              <span className={tipo === t ? 'text-brand' : 'text-muted'}>{ICONE[t]}</span>
              <span>
                <span className="block text-[13.5px] font-semibold">{TIPOS[t].label}</span>
                <span className="block text-[12px] leading-snug text-muted">{TIPOS[t].dica}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {tipo === 'trafego' && (
        <section className="grid gap-2">
          <h3 className="text-[13.5px] font-semibold">Redes</h3>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(REDES) as Rede[]).map((r) => {
              const on = redes.includes(r);
              return (
                <label key={r} className={`cursor-pointer rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${on ? 'border-brand bg-brand text-brand-ink' : 'border-line hover:bg-surface-2'}`}>
                  <input
                    type="checkbox"
                    name="redes"
                    value={r}
                    checked={on}
                    onChange={() => {
                      const rs = on ? redes.filter((x) => x !== r) : [...redes, r];
                      setRedes(rs);
                      sugerir(tipo, rs);
                    }}
                    className="sr-only"
                  />
                  {REDES[r]}
                </label>
              );
            })}
          </div>
        </section>
      )}

      <section className="grid gap-2">
        <h3 className="text-[13.5px] font-semibold">Serviços</h3>
        <ul className="grid gap-1.5">
          {servicos.map((s) => {
            const on = s.id in marcados;
            return (
              <li key={s.id} className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border px-3 py-2 ${on ? 'border-brand/40 bg-brand-soft/50' : 'border-line'}`}>
                <input
                  type="checkbox"
                  name="svc"
                  value={s.id}
                  checked={on}
                  onChange={() =>
                    setMarcados((m) => {
                      const n = { ...m };
                      if (on) delete n[s.id];
                      else n[s.id] = Number(s.preco);
                      return n;
                    })
                  }
                  className="size-4 accent-[var(--color-brand)]"
                  aria-label={s.nome}
                />
                <span className="min-w-0 text-[13px]">
                  <span className="block truncate font-medium">{s.nome}</span>
                  <span className="text-[11.5px] text-muted">{s.cobranca === 'mensal' ? 'mensal' : 'pagamento único'}</span>
                </span>
                {on ? (
                  <input
                    name={`valor_${s.id}`}
                    inputMode="decimal"
                    value={marcados[s.id]}
                    onChange={(e) => setMarcados((m) => ({ ...m, [s.id]: Number(e.target.value.replace(/\./g, '').replace(',', '.')) || 0 }))}
                    className="field w-28 text-right tabular-nums"
                    aria-label={`Valor de ${s.nome}`}
                  />
                ) : (
                  <span className="text-[12.5px] tabular-nums text-muted">{brl(Number(s.preco), false)}</span>
                )}
              </li>
            );
          })}
        </ul>
        <details className="rounded-lg border border-dashed border-line px-3 py-2" open={!!outroInicial}>
          <summary className="cursor-pointer text-[13px] font-medium text-muted">Outro serviço (fora da lista)</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_140px]">
            <input name="outro_nome" defaultValue={outroInicial?.nome} placeholder="Nome do serviço" className="field" />
            <input name="outro_valor" defaultValue={outroInicial?.valor} inputMode="decimal" placeholder="Valor" className="field" />
            <select name="outro_cobranca" defaultValue={outroInicial?.cobranca ?? 'mensal'} className="field">
              <option value="mensal">Mensal</option>
              <option value="unico">Pagamento único</option>
            </select>
          </div>
        </details>
        <p className="text-[12.5px] text-muted">
          Total: <b className="text-ink">{brl(total.mensal, false)}/mês</b>
          {total.unico > 0 && (
            <>
              {' '}
              + <b className="text-ink">{brl(total.unico, false)}</b> único
            </>
          )}
        </p>
      </section>

      <section className="grid gap-3">
        <h3 className="text-[13.5px] font-semibold">Prazo e pagamento</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Vigência">
            <select name="vigencia_meses" defaultValue={inicial?.modelo.vigencia_meses ?? 6} className="field">
              {VIGENCIAS.map((v) => (
                <option key={v} value={v}>
                  {v} meses
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vencimento (dia do mês)">
            <input key={sel?.id ?? 'x'} name="dia_vencimento" type="number" min={1} max={28} defaultValue={inicial?.dia_vencimento ?? sel?.dia_vencimento ?? 10} className="field" />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" name="promo" checked={promo} onChange={(e) => setPromo(e.target.checked)} className="size-4 accent-[var(--color-brand)]" />
          Condição de entrada (valor promocional nos primeiros meses)
        </label>
        {promo && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Valor promocional por mês">
              <input name="promo_valor" inputMode="decimal" required defaultValue={inicial?.modelo.promo_valor ?? ''} placeholder="Ex.: 1000" className="field" />
            </Field>
            <Field label="Por quantos meses">
              <input name="promo_meses" type="number" min={1} max={11} required defaultValue={inicial?.modelo.promo_meses ?? 3} className="field" />
            </Field>
          </div>
        )}
      </section>

      {erro && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{erro}</p>}
      {ok && !clientes && <p className="rounded-lg bg-success-soft px-3 py-2 text-[13px] text-success">Contrato atualizado.</p>}
      <div>
        <button className={btn.primary} disabled={pending}>
          {pending ? 'Salvando…' : botao}
        </button>
      </div>
    </form>
  );
}
