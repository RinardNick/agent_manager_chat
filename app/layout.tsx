import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chat UI',
  description: 'A simple chat interface using ts-mcp-client',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
