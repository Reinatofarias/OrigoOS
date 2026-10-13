'use client';

import { useEffect, useState, useTransition } from 'react';
import { Bell, BellOff, Send } from 'lucide-react';
import { chavePublicaPush, enviarLembreteTeste, removerInscricao, salvarInscricao } from '@/app/actions';
import { btn } from './ui';

function chaveParaBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type Estado = 'carregando' | 'sem-suporte' | 'instalar-iphone' | 'bloqueado' | 'desligado' | 'ligado';

// Liga o lembrete das 7h51 neste aparelho.
export default function Lembrete() {
  const [estado, setEstado] = useState<Estado>('carregando');
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const instalado = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone;
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setEstado(ios && !instalado ? 'instalar-iphone' : 'sem-suporte');
        return;
      }
      if (Notification.permission === 'denied') return setEstado('bloqueado');
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      const sub = await reg.pushManager.getSubscription();
      setEstado(sub ? 'ligado' : 'desligado');
    })().catch(() => setEstado('sem-suporte'));
  }, []);

  const ligar = () =>
    start(async () => {
      setMsg('');
      try {
        const permissao = await Notification.requestPermission();
        if (permissao !== 'granted') {
          setEstado(permissao === 'denied' ? 'bloqueado' : 'desligado');
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(await chavePublicaPush()) });
        await salvarInscricao(JSON.parse(JSON.stringify(sub)));
        setEstado('ligado');
        setMsg('Pronto! Este aparelho vai receber as notificações que estiverem ligadas abaixo.');
      } catch {
        setMsg('Não consegui ligar o lembrete neste aparelho. Tente de novo.');
      }
    });

  const desligar = () =>
    start(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removerInscricao(sub.endpoint);
        await sub.unsubscribe();
      }
      setEstado('desligado');
      setMsg('Notificações desligadas neste aparelho.');
    });

  const testar = () =>
    start(async () => {
      const r = await enviarLembreteTeste();
      setMsg(r.enviados ? `Enviei agora pra ${r.enviados} aparelho(s). Deve chegar em alguns segundos.` : 'Nenhum aparelho com as notificações ligadas.');
    });

  return (
    <div className="grid gap-3">
      {estado === 'carregando' && <p className="text-[13px] text-muted">Verificando este aparelho…</p>}
      {estado === 'instalar-iphone' && (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-[13px] text-warn">
          No iPhone, as notificações só funcionam com o Origo OS instalado: toque em Compartilhar e depois em &quot;Adicionar à Tela de Início&quot;. Abra pelo ícone e volte aqui.
        </p>
      )}
      {estado === 'sem-suporte' && <p className="text-[13px] text-muted">Este navegador não recebe notificações. No celular, instale o Origo OS na tela inicial.</p>}
      {estado === 'bloqueado' && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">As notificações estão bloqueadas pra este site. Libere nas configurações do navegador ou do celular e volte aqui.</p>
      )}
      {(estado === 'desligado' || estado === 'ligado') && (
        <div className="flex flex-wrap items-center gap-2">
          {estado === 'desligado' ? (
            <button type="button" onClick={ligar} disabled={pending} className={btn.primary}>
              <Bell size={15} /> Ligar notificações neste aparelho
            </button>
          ) : (
            <>
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-success">
                <Bell size={15} /> Ligado neste aparelho
              </span>
              <button type="button" onClick={desligar} disabled={pending} className={btn.ghost}>
                <BellOff size={14} /> Desligar
              </button>
            </>
          )}
          <button type="button" onClick={testar} disabled={pending} className={btn.secondary}>
            <Send size={14} /> Mandar um teste agora
          </button>
        </div>
      )}
      {msg && <p className="text-[13px] text-muted">{msg}</p>}
    </div>
  );
}
