'use client';

import { useRouter } from 'next/navigation';

export default function ClientFilter({ clientes, value, f }: { clientes: { id: string; nome: string }[]; value: string; f: string }) {
  const router = useRouter();
  return (
    <select
      aria-label="Filtrar por cliente"
      value={value}
      onChange={(e) => {
        const p = new URLSearchParams({ ...(f !== 'todas' && { f }), ...(e.target.value && { cliente: e.target.value }) });
        router.push(`/tarefas?${p}`);
      }}
      className="field w-auto py-1.5"
    >
      <option value="">Todos os clientes</option>
      {clientes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nome}
        </option>
      ))}
    </select>
  );
}
