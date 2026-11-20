import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Virtual Café',
  description: 'A cozy corner of the internet for getting things done together.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><head><link rel="preload" as="image" href="/art/cafe.webp" fetchPriority="high" /></head><body>{children}</body></html>;
}
