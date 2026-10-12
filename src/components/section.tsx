export default function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {aside && <span className="text-sm text-muted">{aside}</span>}
      </div>
      {children}
    </section>
  );
}
