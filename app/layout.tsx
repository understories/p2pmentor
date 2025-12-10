import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { FloatingButtonCluster } from "@/components/FloatingButtonCluster";
import { AppShell } from "@/components/navigation/AppShell";
import { BackgroundImage } from "@/components/BackgroundImage";

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
          <BackgroundImage />
          <AppShell>
            {children}
          </AppShell>
          <FloatingButtonCluster />
        </ThemeProvider>
      </body>
    </html>
  );
}

