'use client';

import { useState, useTransition } from 'react';
import { PenLine } from 'lucide-react';
import { assinarContrato } from '@/app/actions';
import type { Contract, Contratante, Empresa } from '@/lib/db';
import { clausulas, temEmpresa } from '@/lib/contrato';
import ContratoDoc from '@/components/contrato-doc';

const campo = 'w-full rounded-xl border border-[#d9dbe8] bg-white px-3.5 py-2.5 text-[14px] text-[#14152e] outline-none focus:border-[#6a4cff]';

function F({ label, children, largo }: { label: string; children: React.ReactNode; largo?: boolean }) {
  return (
    <label className={`grid gap-1 ${largo ? 'sm:col-span-2' : ''}`}>
      <span className="text-[12.5px] font-medium text-[#6b6e8a]">{label}</span>
      {children}
    </label>
  );
}

type Dados = {
  representante: string;
  representante_cpf: string;
  nacionalidade: string;
  profissao: string;
  representante_endereco: string;
  email: string;
  telefone: string;
  empresa_nome: string;
  empresa_cnpj: string;
  empresa_endereco: string;
};

// O cliente preenche os dados dele, vê o contrato já montado com eles e assina. Enviar o formulário é a assinatura.
export default function AssinarContrato({ token, c, empresa }: { token: string; c: Contract; empresa: Empresa }) {
  const k = c.contratante;
  const comEmpresa0 = temEmpresa(k) || (!!k.nome && !k.representante);
  const [comEmpresa, setComEmpresa] = useState(comEmpresa0);
  const [d, setD] = useState<Dados>({
    representante: k.representante ?? '',
    representante_cpf: k.representante_cpf ?? '',
    nacionalidade: k.nacionalidade || 'brasileiro(a)',
    profissao: k.profissao ?? '',
    representante_endereco: k.representante_endereco ?? (comEmpresa0 ? '' : (k.endereco ?? '')),
    email: k.email ?? '',
    telefone: k.telefone ?? '',
    empresa_nome: comEmpresa0 ? (k.nome ?? '') : '',
    empresa_cnpj: (k.documento ?? '').replace(/\D/g, '').length === 14 ? (k.documento ?? '') : '',
    empresa_endereco: comEmpresa0 ? (k.endereco ?? '') : '',
  });
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (n: keyof Dados) => (e: React.ChangeEvent<HTMLInputElement>) => setD((x) => ({ ...x, [n]: e.target.value }));

  // Prévia: o contrato com o que a pessoa já digitou.
  const previa: Contratante = {
    representante: d.representante,
    representante_cpf: d.representante_cpf,
    representante_endereco: d.representante_endereco,
    nacionalidade: d.nacionalidade,
    profissao: d.profissao,
    email: d.email,
    telefone: d.telefone,
    nome: comEmpresa && d.empresa_nome ? d.empresa_nome : d.representante,
    documento: comEmpresa && d.empresa_nome ? d.empresa_cnpj : d.representante_cpf,
    endereco: comEmpresa && d.empresa_nome ? d.empresa_endereco : d.representante_endereco,
  };
  const doc = { ...c, contratante: previa };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setErro(null);
        start(async () => {
          const r = await assinarContrato(token, null, fd);
          if (r?.erro) setErro(r.erro);
        });
      }}
      className="grid gap-5"
    >
      <section className="mx-auto grid w-full max-w-[820px] gap-4 rounded-2xl border border-[#e5e7f0] bg-white p-6 text-[#14152e] shadow-xl">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#6a4cff]">Passo 1 de 2</p>
          <h2 className="text-[18px] font-bold">Seus dados para o contrato</h2>
          <p className="text-[13px] text-[#6b6e8a]">Eles entram no contrato logo abaixo, enquanto você digita.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Nome completo *">
            <input name="representante" required autoComplete="name" value={d.representante} onChange={set('representante')} className={campo} />
          </F>
          <F label="CPF *">
            <input name="representante_cpf" required inputMode="numeric" value={d.representante_cpf} onChange={set('representante_cpf')} className={campo} />
          </F>
          <F label="Nacionalidade">
            <input name="nacionalidade" value={d.nacionalidade} onChange={set('nacionalidade')} className={campo} />
          </F>
          <F label="Profissão">
            <input name="profissao" value={d.profissao} onChange={set('profissao')} className={campo} />
          </F>
          <F label="Endereço residencial completo (rua, nº, bairro, cidade/UF, CEP) *" largo>
            <input name="representante_endereco" required autoComplete="street-address" value={d.representante_endereco} onChange={set('representante_endereco')} className={campo} />
          </F>
          <F label="E-mail *">
            <input name="email" type="email" required autoComplete="email" value={d.email} onChange={set('email')} className={campo} />
          </F>
          <F label="WhatsApp *">
            <input name="telefone" required inputMode="tel" autoComplete="tel" value={d.telefone} onChange={set('telefone')} className={campo} />
          </F>
        </div>

        <fieldset className="grid gap-3">
          <legend className="mb-2 text-[13.5px] font-semibold">O contrato é pra uma empresa ou estabelecimento?</legend>
          <div className="flex flex-wrap gap-2">
            {[
              [true, 'Sim, tenho empresa'],
              [false, 'Não, é pra mim (pessoa física)'],
            ].map(([v, l]) => (
              <label key={String(v)} className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${comEmpresa === v ? 'border-[#6a4cff] bg-[#6a4cff] text-white' : 'border-[#d9dbe8]'}`}>
                <input type="radio" name="tem_empresa" checked={comEmpresa === v} onChange={() => setComEmpresa(v as boolean)} className="sr-only" />
                {l as string}
              </label>
            ))}
          </div>
          {comEmpresa && (
            <div className="grid gap-3 sm:grid-cols-2">
              <F label="Nome da empresa ou estabelecimento *">
                <input name="empresa_nome" required value={d.empresa_nome} onChange={set('empresa_nome')} className={campo} />
              </F>
              <F label="CNPJ (se tiver)">
                <input name="empresa_cnpj" inputMode="numeric" value={d.empresa_cnpj} onChange={set('empresa_cnpj')} className={campo} />
              </F>
              <F label="Endereço da empresa *" largo>
                <input name="empresa_endereco" required value={d.empresa_endereco} onChange={set('empresa_endereco')} className={campo} />
              </F>
            </div>
          )}
        </fieldset>
      </section>

      <ContratoDoc c={doc} empresa={empresa} itens={clausulas(empresa, doc)} />

      <section className="mx-auto grid w-full max-w-[820px] gap-4 rounded-2xl border border-[#e5e7f0] bg-white p-6 text-[#14152e] shadow-xl">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#6a4cff]">Passo 2 de 2</p>
          <h2 className="text-[18px] font-bold">Assinar</h2>
        </div>
        <label className="flex items-start gap-2.5 text-[13.5px]">
          <input type="checkbox" name="aceite" required className="mt-0.5 size-4 accent-[#6a4cff]" />
          Li o contrato acima, confirmo que meus dados estão corretos e concordo com todas as cláusulas. Sei que esta assinatura eletrônica tem validade jurídica.
        </label>
        {erro && <p className="rounded-lg bg-[#fde8e9] px-3 py-2 text-[13px] text-[#c62f35]">{erro}</p>}
        <div>
          <button disabled={pending} className="bg-grad inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold text-white shadow-lg disabled:opacity-60">
            <PenLine size={16} /> {pending ? 'Assinando…' : 'Assinar contrato'}
          </button>
        </div>
      </section>
    </form>
  );
}
