import type { NextConfig } from "next";

// Proteções do navegador em todas as páginas.
const seguranca = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Não manda o endereço da página (com o código dos links de proposta, contrato e portal) pra outros sites.
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Microfone só pro próprio sistema (captura por voz); câmera e localização desligadas.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=()" },
  // Sistema interno: nada aparece no Google.
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: seguranca },
      {
        // Nenhum outro site pode abrir o sistema dentro de um quadro (golpe de clique escondido)...
        source: "/((?!f(?:/|$)).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
        ],
      },
      {
        // ...menos o formulário de contato, que pode ir dentro do site da Origo.
        source: "/f",
        headers: [{ key: "Content-Security-Policy", value: "base-uri 'self'; form-action 'self'; object-src 'none'" }],
      },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
};

export default nextConfig;
