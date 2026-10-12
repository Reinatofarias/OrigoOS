import 'server-only';

// Pedidos da Vercel Cron. Com CRON_SECRET na Vercel, a Vercel manda "Bearer <segredo>" e só ela passa.
// Sem a variável, aceita pelo nome do robô (mais fraco; a tela de Segurança avisa).
export function cronAutorizado(request: Request) {
  const segredo = process.env.CRON_SECRET?.trim();
  if (segredo) return request.headers.get('authorization') === `Bearer ${segredo}`;
  return (request.headers.get('user-agent') ?? '').includes('vercel-cron');
}

export const cronProtegido = () => !!process.env.CRON_SECRET?.trim();
