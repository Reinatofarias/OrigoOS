import { requireAuth } from '@/lib/auth';
import Nav from '@/components/nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 md:pb-10">
      <Nav />
      {children}
    </div>
  );
}
