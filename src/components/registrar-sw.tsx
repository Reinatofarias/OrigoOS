'use client';

import { useEffect } from 'react';

// Registra o service worker (necessário pra instalar como app e pra receber o lembrete).
export default function RegistrarSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {});
  }, []);
  return null;
}
