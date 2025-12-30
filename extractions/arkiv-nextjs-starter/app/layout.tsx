import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Arkiv Next.js Starter',
  description: 'A starter template for building Arkiv applications with Next.js',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

