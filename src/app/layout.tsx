import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import BackgroundGrid from "@/components/BackgroundGrid";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import "./globals.css";

const inter = Inter({ variable: "--font-sans", subsets: ["latin", "cyrillic"] });
const jbMono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TransLang AI — omni-translator",
  description:
    "Any-to-any dictionary & translator (EN · RU · DA · DE · SV · PT). Voice in/out, idiom-aware, multi-source compare. Mobile-first PWA.",
  applicationName: "TransLang AI",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "TransLang AI",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    // Splash & status-bar tint — matches the logo's mid-grey chip gradient
    // so the PWA splash on Android shows a continuous frame around the
    // logo instead of a black backdrop.
    { media: "(prefers-color-scheme: light)", color: "#3f3f46" },
    { media: "(prefers-color-scheme: dark)", color: "#3f3f46" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jbMono.variable} antialiased`}>
      <body className="relative min-h-dvh bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 flex flex-col">
        <BackgroundGrid />
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
