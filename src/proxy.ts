import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, versaoValida, verifySessionToken } from '@/lib/sessao';

// Antes de qualquer página interna: confere a assinatura, a validade e a versão da sessão.
// As páginas e ações conferem de novo no servidor (requireAuth).
export async function proxy(request: NextRequest) {
  const ok = await versaoValida(verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)).catch(() => false);
  if (!ok) {
    const r = NextResponse.redirect(new URL('/login', request.url));
    if (request.cookies.has(SESSION_COOKIE)) r.cookies.delete(SESSION_COOKIE);
    return r;
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!login|_next|favicon.ico|icon.png|apple-icon.png|robots.txt|brand/|p/|c/|r/|f$|f/|portal/|api/asaas|api/lembrete|api/avisos|api/noturno|api/metricas|sw.js|manifest.webmanifest).*)',
  ],
};
