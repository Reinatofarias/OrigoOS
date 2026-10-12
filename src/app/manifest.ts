import type { MetadataRoute } from 'next';

// Deixa instalar o Origo OS como app na tela inicial do celular.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Origo OS',
    short_name: 'Origo OS',
    description: 'Sistema interno da Origo Company',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#05050f',
    theme_color: '#0b0c24',
    lang: 'pt-BR',
    icons: [
      { src: '/brand/app-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/app-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/app-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
