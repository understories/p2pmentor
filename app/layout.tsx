import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { FloatingButtonCluster } from "@/components/FloatingButtonCluster";
import { ConditionalAppShell } from "@/components/navigation/ConditionalAppShell";
import { BackgroundImage } from "@/components/BackgroundImage";
import { ClientPerfTracker } from "@/components/ClientPerfTracker";

export const metadata: Metadata = {
  title: "p2pmentor",
  description: "Teach, learn, and mentor without intermediaries. Own your data.",
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="relative min-h-screen">
        <ThemeProvider>
          <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-black text-center py-1 text-xs font-semibold">
            PLAYGROUND
          </div>
          <BackgroundImage />
          <ClientPerfTracker />
          <ConditionalAppShell>
            {children}
          </ConditionalAppShell>
          <FloatingButtonCluster />
        </ThemeProvider>
      </body>
    </html>
  );
}

