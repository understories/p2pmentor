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
      <body suppressHydrationWarning>
        <ThemeProvider>
          {children}
          <FloatingButtonCluster />
        </ThemeProvider>
      </body>
    </html>
  );
}

