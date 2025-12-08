import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";

export const metadata: Metadata = {
  title: "p2pmentor - Peer to Peer Mentorship",
  description: "Teach, learn, and mentor without intermediaries. Own your data.",
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
          <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-black text-center py-1 text-xs font-semibold">
            PLAYGROUND
          </div>
          <div className="pt-6">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}

