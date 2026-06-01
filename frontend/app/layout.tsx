import type { Metadata } from "next";
import "./globals.css";
import AuthiGradientDefs from "@/components/AuthiGradientDefs";
import { AuthProvider } from "@/lib/AuthContext";

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
        <AuthiGradientDefs />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

