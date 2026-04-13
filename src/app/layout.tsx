import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/layout/header";
import { AuthProvider } from "@/components/auth/auth-provider";
import { Footer } from "@/components/layout/footer";
import { ScrollToTop } from "@/components/scroll-to-top";
import { PWARegister } from "@/components/pwa-register";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceProvider } from "@/components/workspace/workspace-provider";
import { DeployWorkspacePanel } from "@/components/workspace/deploy-workspace-panel";
import { Toaster } from "sonner";
import { buildRootMetadata } from "@/lib/seo/root-metadata";
import { LazyAmbientScene } from "@/components/three/lazy-ambient-scene";
import { PHProvider, SWRProvider } from "./providers";

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

export const metadata: Metadata = buildRootMetadata();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/apple-icon" />
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen font-sans antialiased`}
      >
        <SWRProvider>
          <PHProvider>
            <AuthProvider>
              <WorkspaceProvider>
                <TooltipProvider>
                  <a
                    href="#main-content"
                    className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-neon focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-background focus:outline-none"
                  >
                    Skip to main content
                  </a>
                  <LazyAmbientScene />
                  <Header />
                  <main id="main-content" className="relative z-10 min-h-[calc(100vh-4rem)]">{children}</main>
                  <Footer />
                  <DeployWorkspacePanel />
                  <ScrollToTop />
                  <PWARegister />
                </TooltipProvider>
              </WorkspaceProvider>
            </AuthProvider>
          </PHProvider>
        </SWRProvider>
        <Toaster theme="dark" position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
