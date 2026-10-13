// Aparece na hora do clique enquanto a página busca os dados. Também deixa o Next adiantar
// (prefetch) o começo de cada tela, então a troca de página fica instantânea.
export default function Carregando() {
  const bloco = 'animate-pulse rounded-xl bg-surface-2';
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="border-b border-line bg-surface px-4 py-4 md:px-8 md:py-5">
        <div className={`${bloco} h-6 w-48`} />
        <div className={`${bloco} mt-2 h-4 w-72 max-w-full`} />
      </div>
      <div className="mx-auto grid w-full max-w-[1280px] gap-4 px-4 py-6 md:px-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`${bloco} h-24`} />
          ))}
        </div>
        <div className={`${bloco} h-64`} />
        <div className={`${bloco} h-40`} />
      </div>
    </div>
  );
}
