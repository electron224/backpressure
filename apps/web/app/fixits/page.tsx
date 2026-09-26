import Link from "next/link";
import type { ReactElement } from "react";

const FIXITS = [
  { slug: "melting-api", title: "Melting API" },
  { slug: "lonely-database", title: "Lonely database" },
  { slug: "open-floodgate", title: "Open floodgate" },
];

export default function FixitsPage(): ReactElement {
  return (
    <main>
      <p className="mt-8 font-mono text-sm text-smoke">real architectures, real breakage</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Fix it</h1>
      <p className="mt-3 max-w-2xl leading-relaxed">
        Broken production architectures, not sliders. Add components until the same traffic passes — the simulator
        decides, not your confidence.
      </p>
      <ul className="mt-6 space-y-2">
        {FIXITS.map((fixit) => (
          <li key={fixit.slug} className="border-b border-ink/10 pb-2">
            <Link href={`/fixits/${fixit.slug}`} className="hover:text-ember">
              {fixit.title}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6">
        <Link href="/" className="hover:text-ember">
          Back to labs
        </Link>
      </p>
    </main>
  );
}
