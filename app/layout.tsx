import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { FloatingButtonCluster } from "@/components/FloatingButtonCluster";
import { ConditionalAppShell } from "@/components/navigation/ConditionalAppShell";
import { BackgroundImage } from "@/components/BackgroundImage";
import { ClientPerfTracker } from "@/components/ClientPerfTracker";
import { GlobalToggles } from "@/components/GlobalToggles";
import { ArkivModeBanner } from "@/components/ArkivModeBanner";
import { NavigationTracker } from "@/components/NavigationTracker";
import { NoScriptRedirect } from "@/components/NoScriptRedirect";

export const metadata: Metadata = {
  title: "p2pmentor",
  description: "Teach, learn, and mentor without intermediaries. Own your data.",
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="relative min-h-screen">
        <NoScriptRedirect />
        <ThemeProvider>
          <GlobalToggles />
          <ArkivModeBanner />
          <NavigationTracker />
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

