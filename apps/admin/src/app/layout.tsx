import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Admin — Blog Platform",
    template: "%s | Admin",
  },
  robots: { index: false, follow: false },
};

/**
 * Applies the persisted theme before first paint to avoid a flash of the
 * wrong theme. Must stay a blocking inline script — React effects run too late.
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem("admin-theme")||"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
