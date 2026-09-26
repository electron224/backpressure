import Link from "next/link";
import type { ReactElement } from "react";
import { compileMDX } from "next-mdx-remote/rsc";
import { getProblem } from "../../../lib/problems";
import { InterviewFlow } from "../../../components/interview-flow";

export default async function ProblemPage(): Promise<ReactElement> {
  const problem = getProblem("design-url-shortener");
  const { content } = await compileMDX({ source: problem.briefMdx });
  return (
    <main>
      <p className="mt-8 font-mono text-sm text-smoke">01 Brief</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{problem.meta.title}</h1>
      <section aria-label="Brief">
        <div className="prose mt-4 max-w-2xl leading-relaxed">{content}</div>
      </section>
      <section aria-label="Scale" className="mt-8 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">Scale (revealed on request in a real loop)</h2>
        <ul className="mt-3 space-y-1 font-mono text-sm">
          {Object.entries(problem.scale).map(([key, value]) => (
            <li key={key}>
              {key}: {String(value)}
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Clarifications" className="mt-8 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">Clarifications (revealed only if asked)</h2>
        <ul className="mt-3 space-y-2">
          {problem.clarifications.map((item) => (
            <li key={item.q} className="border-b border-ink/10 pb-2">
              {item.q} — {item.a}
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Design" className="mt-8 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">High-level design</h2>
        <p className="mt-3">
          Draw on the <Link href="/design" className="hover:text-ember">canvas</Link>, then run the timed loop below.
        </p>
      </section>
      <InterviewFlow slug="design-url-shortener" rubric={problem.rubric} scenarios={problem.scenarios} />
    </main>
  );
}
