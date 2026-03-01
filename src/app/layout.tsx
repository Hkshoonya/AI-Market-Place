import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/layout/header";
import { AuthProvider } from "@/components/auth/auth-provider";
import { Footer } from "@/components/layout/footer";
import { ScrollToTop } from "@/components/scroll-to-top";
import { PWARegister } from "@/components/pwa-register";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "@/lib/constants/site";
import { AmbientScene } from "@/components/three/ambient-scene";
import { MarketTicker } from "@/components/layout/market-ticker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#000000" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: SITE_NAME,
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen font-sans antialiased`}
      >
        <AuthProvider>
          <TooltipProvider>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-neon focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-background focus:outline-none"
            >
              Skip to main content
            </a>
            <AmbientScene />
            <Header />
            <MarketTicker />
            <main id="main-content" className="relative z-10 min-h-[calc(100vh-4rem)]">{children}</main>
            <Footer />
            <ScrollToTop />
            <PWARegister />
          </TooltipProvider>
        </AuthProvider>
        <Toaster theme="dark" position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
