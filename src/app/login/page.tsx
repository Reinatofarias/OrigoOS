import Image from 'next/image';
import { redirect } from 'next/navigation';
import { isAuthenticated, isLoginConfigured } from '@/lib/auth';
import { db } from '@/lib/db';
import { lerSeguranca } from '@/lib/seguranca';
import LoginForm from './login-form';

export default async function LoginPage() {
  if (await isAuthenticated()) redirect('/');
  const comCodigo = isLoginConfigured() ? (await lerSeguranca(db())).totp_ativo : false;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,#1a1450_0%,#05050f_60%)] px-4 py-10">
      <div className="w-full max-w-sm">
        <Image
          src="/brand/origo-os-vertical.png"
          alt="Origo OS"
          width={240}
          height={208}
          priority
          className="mx-auto h-auto w-[200px] sm:w-[240px]"
        />
        <p className="mt-4 text-center text-[14px] text-sidebar-ink">Sistema interno da Origo Company</p>
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur">
          <LoginForm comCodigo={comCodigo} />
        </div>
      </div>
    </main>
  );
}
