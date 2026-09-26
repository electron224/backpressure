import Link from "next/link";
import type { ReactElement } from "react";
import { compileMDX } from "next-mdx-remote/rsc";
import { getProblem } from "../../../lib/problems";
import { InterviewFlow } from "../../../components/interview-flow";

const SIBLINGS: { slug: string; title: string }[] = [
  { slug: "design-url-shortener", title: "Design a URL Shortener" },
  { slug: "design-twitter", title: "Design Twitter" },
];

export function generateStaticParams(): { slug: string }[] {
  return SIBLINGS.map(({ slug }) => ({ slug }));
}

export default async function ProblemPage({ params }: { params: { slug: string } }): Promise<ReactElement> {
  const problem = getProblem(params.slug);
  const { content } = await compileMDX({ source: problem.briefMdx });
  const estimationBands: { qps: [number, number]; storageGb: [number, number]; bandwidthMbps: [number, number] } =
    params.slug === "design-twitter"
      ? { qps: [50000, 5000000], storageGb: [1000000, 1000000000], bandwidthMbps: [100, 100000] }
      : { qps: [100, 20000], storageGb: [100, 10000], bandwidthMbps: [1, 1000] };
  return (
    <main>
      <p className="mt-8 font-mono text-sm text-smoke">01 Brief</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{problem.meta.title}</h1>
      <section aria-label="Brief">
        <div className="prose mt-4 max-w-2xl leading-relaxed">{content}</div>
      </section>
      <nav aria-label="Problems" className="mt-6 border-t border-ink/20 pt-4">
        <h2 className="text-xl font-bold">Other interviews</h2>
        <ul className="mt-3 space-y-1">
          {SIBLINGS.filter((sibling) => sibling.slug !== params.slug).map((sibling) => (
            <li key={sibling.slug}>
              <Link href={`/problems/${sibling.slug}`} className="hover:text-ember">
                {sibling.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
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
      <InterviewFlow
        slug={params.slug}
        rubric={problem.rubric}
        scenarios={problem.scenarios}
        estimationBands={estimationBands}
      />
    </main>
  );
}
