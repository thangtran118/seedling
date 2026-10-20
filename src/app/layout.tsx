import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/app/ui/sw-register";
import { THEME_SCRIPT } from "@/app/ui/theme-script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Seedling",
  description: "Quản lý ca trudo và chiên",
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Seedling", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // No themeColor here: THEME_SCRIPT owns <meta name="theme-color"> so it follows the chosen theme.
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: THEME_SCRIPT sets data-theme on <html> before React hydrates.
    <html lang="vi" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
