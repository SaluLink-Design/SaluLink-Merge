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
      <body className="antialiased bg-slate-950 text-slate-100">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur">
          <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-3xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-lg font-bold">
                S
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">SaluLink</p>
                <p className="text-base font-semibold text-white">Chronic Treatment App</p>
              </div>
            </div>
            <nav className="flex items-center gap-4 text-sm text-slate-300">
              <Link href="/" className="hover:text-white transition">Home</Link>
              <Link href="/" className="hover:text-white transition">Dashboard</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}

