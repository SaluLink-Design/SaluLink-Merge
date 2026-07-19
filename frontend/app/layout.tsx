import type { Metadata } from "next";
import "./globals.css";
import AuthiGradientDefs from "@/components/AuthiGradientDefs";
import { AuthProvider } from "@/lib/AuthContext";

export const metadata: Metadata = {
  title: "SaluLink Chronic Treatment App",
  description: "Healthcare professional tool for chronic condition management and PMB compliance",
};

const chunkRecoveryScript = `
  (() => {
    const recoveryKey = 'salulink-chunk-recovery';
    const isChunkError = (value) => {
      const message = String(value?.message || value?.reason?.message || value?.reason || value || '');
      return message.includes('ChunkLoadError') || /Loading chunk .+ failed/i.test(message);
    };
    const recover = (event) => {
      if (!isChunkError(event?.error || event)) return;
      const lastRecovery = Number(sessionStorage.getItem(recoveryKey) || 0);
      if (Date.now() - lastRecovery < 15000) return;
      sessionStorage.setItem(recoveryKey, String(Date.now()));
      window.location.reload();
    };
    window.addEventListener('error', recover);
    window.addEventListener('unhandledrejection', recover);
    window.addEventListener('load', () => {
      window.setTimeout(() => sessionStorage.removeItem(recoveryKey), 15000);
    });
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: chunkRecoveryScript }} />
      </head>
      <body className="antialiased bg-white text-slate-900">
        <AuthiGradientDefs />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

