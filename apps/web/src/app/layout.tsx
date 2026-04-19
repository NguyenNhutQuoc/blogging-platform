import type { Metadata } from "next";
import { Toaster } from "@repo/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Blog Platform",
    template: "%s | Blog Platform",
  },
  description: "A professional multi-author blogging platform.",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <SiteHeader />
        <main className="container mx-auto max-w-5xl px-4 py-8">{children}</main>
        <SiteFooter />
        <Toaster />
      </body>
    </html>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="container mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <a href="/" className="text-xl font-bold text-foreground">
          Blog Platform
        </a>
        <div className="flex items-center gap-4">
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Home
          </a>
          <a href="/search" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Search
          </a>
        </div>
      </nav>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t mt-16">
      <div className="container mx-auto max-w-5xl px-4 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Blog Platform. All rights reserved.
      </div>
    </footer>
  );
}
