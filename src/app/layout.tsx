import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const geist = localFont({
  src: './fonts/Geist-Variable.woff2',
  variable: '--font-geist-sans',
  weight: '100 900',
  display: 'swap',
});
const geistMono = localFont({
  src: './fonts/GeistMono-Variable.woff2',
  variable: '--font-geist-mono',
  weight: '100 900',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'CodeBloom — programming, explained one idea at a time', template: '%s · CodeBloom' },
  description:
    'A patient programming tutor for beginners. Explanations in plain language, help reading your code, and small practice exercises. No sign-up, no password.',
  applicationName: 'CodeBloom',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FAFAF9',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="cb">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
