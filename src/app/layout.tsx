import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const body = Inter({ variable: '--font-body', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Origo OS',
  description: 'Sistema interno da Origo Company',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0b0c24',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${body.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-[14px]">{children}</body>
    </html>
  );
}
