import type { Metadata } from "next";
import "./globals.css";

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
      <body className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

