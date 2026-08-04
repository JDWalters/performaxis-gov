import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PerformAxis — Government",
  description: "Municipal performance management, from national oversight down to department capture.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
