import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: 'Next Prototype Starter',
  description: 'A clean Next.js 15 base ready for rapid prototyping with Supabase support.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body className="antialiased bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}
