import { requireAuth } from '@/lib/auth';
import Sidebar from '@/components/sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="pb-24 md:pb-0 md:pl-60">{children}</div>
    </div>
  );
}
