import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { ESTADO_COOKIE, agendaConfigurada, linkDeConexao, origemDe } from '@/lib/google-agenda';

// Botão "Conectar Google Agenda": manda pro Google pedir a permissão.
export async function GET(request: Request) {
  const origem = origemDe(request.headers);
  if (!(await isAuthenticated())) return NextResponse.redirect(`${origem}/login`);
  if (!agendaConfigurada()) return NextResponse.redirect(`${origem}/configuracoes?tab=integracoes&agenda=sem-chaves`);
  const estado = randomBytes(24).toString('base64url');
  const r = NextResponse.redirect(linkDeConexao(origem, estado));
  r.cookies.set(ESTADO_COOKIE, estado, { httpOnly: true, secure: origem.startsWith('https'), sameSite: 'lax', path: '/api/google-agenda', maxAge: 600 });
  return r;
}
