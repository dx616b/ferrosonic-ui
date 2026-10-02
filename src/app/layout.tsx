import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Syne } from "next/font/google";

import "./globals.css";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07131c",
};

export const metadata: Metadata = {
  title: "Ferrosonic — Player Control",
  description:
    "Web control surface for the Ferrosonic Subsonic player: transport, volume, queue, and daemon status.",
  applicationName: "Ferrosonic",
  appleWebApp: {
    capable: true,
    title: "Ferrosonic",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${instrument.variable} ${syne.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
