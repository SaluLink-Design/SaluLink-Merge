import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "SaluLink Chronic Treatment App",
  description: "Healthcare professional tool for chronic condition management and PMB compliance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-primary-50">
        <header className="bg-white border-b">
          <div className="max-w-6xl mx-auto flex items-center justify-between p-4">
            <div className="text-lg font-semibold">SaluLink Chronic Treatment App</div>
            <nav>
              <Link href="/" className="mr-4 text-sm text-gray-700">Home</Link>
              <Link href="/dashboard" className="text-sm text-gray-700">Dashboard</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}

