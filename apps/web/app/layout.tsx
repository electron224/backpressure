import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>
        <header className="bg-ink text-paper">
          <div className="mx-auto flex max-w-4xl flex-wrap items-baseline gap-x-6 gap-y-1 px-4 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight">
              Backpressure
            </Link>
            <nav aria-label="Primary" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <Link href="/">Labs</Link>
              <Link href="/design">Design canvas</Link>
              <Link href="/problems/design-url-shortener">Interview: URL shortener</Link>
            </nav>
          </div>
          <div className="h-0.5 bg-ember" aria-hidden="true" />
        </header>
        <div className="mx-auto max-w-4xl px-4 pb-16">{children}</div>
      </body>
    </html>
  );
}
