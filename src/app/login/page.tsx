import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import LoginForm from './login-form';

export default async function LoginPage() {
  if (await isAuthenticated()) redirect('/');
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold">Origo OS</h1>
        <p className="text-muted">Sistema interno da Origo Company.</p>
      </div>
      <LoginForm />
    </main>
  );
}
