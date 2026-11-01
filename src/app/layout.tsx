import type { Metadata, Viewport } from "next";
import { StoreProvider } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bima Audit",
  description: "Discharge-desk auditor for Indian health-insurance bills against IRDAI rules.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Bima Audit", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F2F7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh pb-16">
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
