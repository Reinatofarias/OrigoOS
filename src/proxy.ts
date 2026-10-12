import { NextResponse, type NextRequest } from 'next/server';

// Checagem otimista: sem cookie de sessão, manda para o login.
// A validação de verdade acontece no servidor, em cada página e ação (requireAuth).
export function proxy(request: NextRequest) {
  if (!request.cookies.has('origo_session')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!login|_next|favicon.ico|icon.png|apple-icon.png|brand/|p/|api/asaas|manifest.webmanifest).*)'],
};
