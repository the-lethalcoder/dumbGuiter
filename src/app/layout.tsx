import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'dumbGuiter - Realistic Chord-to-Guitar Web Audio Player',
  description: 'Type any chord progression or song sheet, and hear realistic acoustic guitar strumming in real-time with an interactive fretboard visualizer.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="theme-color" content="#090d16" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased bg-[#090d16] text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
