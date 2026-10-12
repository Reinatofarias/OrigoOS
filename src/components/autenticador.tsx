'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { ShieldCheck } from 'lucide-react';
import { confirmarAutenticador, desligarAutenticador, iniciarAutenticador } from '@/app/acoes/seguranca';
import { btn } from './ui';

// Liga ou desliga o código do Google Authenticator no login.
export default function Autenticador({ ativo }: { ativo: boolean }) {
  const [pending, start] = useTransition();
  const [qr, setQr] = useState<{ segredo: string; qr: string } | null>(null);
  const [codigo, setCodigo] = useState('');
  const [msg, setMsg] = useState('');
  const [desligando, setDesligando] = useState(false);

  if (ativo && !desligando) {
    return (
      <div className="grid gap-3">
        <p className="flex items-center gap-2 text-[13.5px] font-semibold text-success">
          <ShieldCheck size={17} /> Ligado: o login pede senha e o código do app.
        </p>
        <div>
          <button type="button" onClick={() => setDesligando(true)} className={btn.ghost}>
            Desligar
          </button>
        </div>
      </div>
    );
  }

  const enviar = (fn: (c: string) => Promise<{ erro?: string; ok?: boolean }>) =>
    start(async () => {
      const r = await fn(codigo);
      if (r.erro) setMsg(r.erro);
      else {
        setMsg('');
        setQr(null);
        setDesligando(false);
        setCodigo('');
      }
    });

  const campoCodigo = (
    <input
      value={codigo}
      onChange={(e) => setCodigo(e.target.value)}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={7}
      placeholder="Código de 6 números"
      aria-label="Código do autenticador"
      className="field w-[190px] tracking-[0.2em]"
    />
  );

  if (desligando) {
    return (
      <div className="grid gap-2">
        <p className="text-[13px] text-muted">Pra desligar, digite o código que está aparecendo no app agora.</p>
        <div className="flex flex-wrap gap-2">
          {campoCodigo}
          <button type="button" disabled={pending} onClick={() => enviar(desligarAutenticador)} className={btn.secondary}>
            Desligar
          </button>
          <button type="button" onClick={() => setDesligando(false)} className={btn.ghost}>
            Cancelar
          </button>
        </div>
        {msg && <p className="text-[13px] text-danger">{msg}</p>}
      </div>
    );
  }

  if (!qr) {
    return (
      <div className="grid gap-3">
        <p className="text-[13px] text-muted">
          Além da senha, o login passa a pedir o código de 6 números do Google Authenticator (ou outro app autenticador). A sessão dura 30 dias, então é uma vez por mês em cada aparelho.
        </p>
        <div>
          <button type="button" disabled={pending} onClick={() => start(async () => setQr(await iniciarAutenticador()))} className={btn.primary}>
            <ShieldCheck size={15} /> Ligar verificação em duas etapas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <ol className="grid list-decimal gap-1.5 pl-5 text-[13px]">
        <li>Instale o Google Authenticator no celular (App Store ou Play Store).</li>
        <li>No app, toque em + e em &quot;Ler código QR&quot;, e aponte pra imagem abaixo.</li>
        <li>Digite aqui o código de 6 números que aparecer.</li>
      </ol>
      <Image src={qr.qr} alt="QR Code do autenticador" width={180} height={180} unoptimized className="rounded-lg border border-line bg-white p-1" />
      <p className="text-[12px] text-muted">
        Sem câmera? Digite esta chave no app: <code className="break-all rounded bg-surface-2 px-1">{qr.segredo}</code>
      </p>
      <div className="flex flex-wrap gap-2">
        {campoCodigo}
        <button type="button" disabled={pending} onClick={() => enviar(confirmarAutenticador)} className={btn.primary}>
          Confirmar e ligar
        </button>
      </div>
      {msg && <p className="text-[13px] text-danger">{msg}</p>}
    </div>
  );
}
