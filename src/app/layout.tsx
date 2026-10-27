import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ThemeProvider } from "@/hooks/useTheme";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "VideoVault", template: "%s · VideoVault" },
  description: "VideoVault — fast, clean and legitimate video downloads.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('videovault-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d){document.documentElement.classList.add('dark');}}catch(e){}})();",
          }}
        />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-zinc-950 dark:text-zinc-50">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
