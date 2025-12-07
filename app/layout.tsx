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
    <html lang="en">
      <body style={{
        background: 'linear-gradient(180deg, #0a0e0f 0%, #050708 100%)',
        color: '#ffffff',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif",
        minHeight: '100vh',
        overflowX: 'hidden',
        position: 'relative',
        margin: 0,
        padding: 0,
      }}>
        {children}
      </body>
    </html>
  );
}

