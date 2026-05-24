import type { Metadata } from "next";
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
      <body className="antialiased bg-white text-slate-900">
        {children}
      </body>
    </html>
  );
}

