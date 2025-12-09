import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { FeedbackButton } from "@/components/FeedbackButton";

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
          <GitHubButton />
        <FeedbackButton />
        </ThemeProvider>
      </body>
    </html>
  );
}

