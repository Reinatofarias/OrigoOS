import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { db } from '@/lib/db';
import { ESTADO_COOKIE, concluirConexao, origemDe } from '@/lib/google-agenda';

// Volta do Google depois que o Renato autoriza.
export async function GET(request: Request) {
  const origem = origemDe(request.headers);
  if (!(await isAuthenticated())) return NextResponse.redirect(`${origem}/login`);
  const url = new URL(request.url);
  const estado = request.headers.get('cookie')?.match(new RegExp(`(?:^|; )${ESTADO_COOKIE}=([^;]+)`))?.[1];
  const volta = (resultado: string) => {
    const r = NextResponse.redirect(`${origem}/configuracoes?tab=integracoes&agenda=${encodeURIComponent(resultado)}`);
    r.cookies.set(ESTADO_COOKIE, '', { path: '/api/google-agenda', maxAge: 0 });
    return r;
  };
  if (url.searchParams.get('error')) return volta('cancelado');
  const codigo = url.searchParams.get('code');
  if (!codigo || !estado || url.searchParams.get('state') !== estado) return volta('expirou');
  try {
    await concluirConexao(db(), origem, codigo);
    return volta('ok');
  } catch (e) {
    console.error('Google Agenda:', e);
    return volta('erro');
  }
}
