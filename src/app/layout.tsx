import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import './globals.css';

const display = Bricolage_Grotesque({ variable: '--font-display-face', subsets: ['latin'], weight: ['600', '800'] });
const body = Figtree({ variable: '--font-body', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Origo OS',
  description: 'Sistema interno da Origo Company',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0f6b55',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
