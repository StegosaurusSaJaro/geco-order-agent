import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GECO Order Dashboard',
  description: 'Staff inbox and chat monitor',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
