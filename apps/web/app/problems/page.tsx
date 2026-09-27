import Link from "next/link";
import type { ReactElement } from "react";

const PROBLEMS: { slug: string; title: string; level: string }[] = [
  { slug: "design-url-shortener", title: "Design a URL Shortener", level: "SDE2" },
  { slug: "design-chat", title: "Design a Chat Service", level: "SDE2" },
  { slug: "design-twitter", title: "Design Twitter", level: "SDE3" },
  { slug: "design-video", title: "Design a Video Service", level: "SDE3" },
  { slug: "design-dropbox", title: "Design a File Sync Service", level: "SDE3" },
];

export default function ProblemsPage(): ReactElement {
  return (
    <main>
      <p className="mt-8 font-mono text-sm text-smoke">mock loops</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Design interviews</h1>
      <p className="mt-3 max-w-2xl leading-relaxed">
        Timed 5-phase loops with deterministic grading: requirements, estimation, API, canvas design, deep dive.
        Finish the required labs first — each problem lists them on its readiness banner.
      </p>
      <ul className="mt-6 space-y-2">
        {PROBLEMS.map((problem) => (
          <li key={problem.slug} className="flex flex-wrap items-baseline gap-x-3 border-b border-ink/10 pb-2">
            <Link href={`/problems/${problem.slug}`} className="hover:text-ember">
              {problem.title}
            </Link>
            <span className="font-mono text-sm text-smoke">{problem.level}</span>
            <Link href={`/problems/${problem.slug}/ladder`} className="font-mono text-sm text-smoke hover:text-ember">
              ladder
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
