import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { FloatingButtonCluster } from "@/components/FloatingButtonCluster";

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
        {/* Background Image */}
        <div 
          className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat opacity-30 dark:opacity-15"
          style={{
            backgroundImage: 'url(/understory.jpeg)',
          }}
        />
        {/* Overlay for better text readability */}
        <div className="fixed inset-0 -z-10 bg-white/40 dark:bg-gray-900/60" />
        
        <ThemeProvider>
          {children}
          <FloatingButtonCluster />
        </ThemeProvider>
      </body>
    </html>
  );
}

