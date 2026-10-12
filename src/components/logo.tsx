import Image from 'next/image';

// Marca oficial do Origo OS (PNG sem fundo em public/brand). Feita pra fundo escuro.
export function Logo({ height = 34 }: { height?: number }) {
  return (
    <Image
      src="/brand/origo-os-horizontal.png"
      alt="Origo OS"
      width={Math.round((height * 826) / 300)}
      height={height}
      priority
    />
  );
}
