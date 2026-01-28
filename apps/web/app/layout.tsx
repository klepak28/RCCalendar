import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Raccoon Cleaning Calendar',
  description: 'Cleaning company scheduling',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
