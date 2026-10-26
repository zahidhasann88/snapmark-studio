import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SnapMark Studio — Browser-Based Screenshot Annotation & Redaction',
  description:
    'Mark up, highlight, and blur screenshots right in your browser. Private by design — nothing is ever uploaded.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-[100dvh]">{children}</body>
    </html>
  );
}
