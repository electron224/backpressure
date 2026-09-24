import Link from "next/link";
import type { ReactElement } from "react";
import { compileMDX } from "next-mdx-remote/rsc";
import { getProblem } from "../../../lib/problems";
import { GradeForm } from "../../../components/grade-form";

export default async function ProblemPage(): Promise<ReactElement> {
  const problem = getProblem("design-url-shortener");
  const { content } = await compileMDX({ source: problem.briefMdx });
  return (
    <main>
      <h1>{problem.meta.title}</h1>
      <section aria-label="Brief">{content}</section>
      <section aria-label="Scale">
        <h2>Scale (revealed on request in a real loop)</h2>
        <ul>
          {Object.entries(problem.scale).map(([key, value]) => (
            <li key={key}>
              {key}: {String(value)}
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Clarifications">
        <h2>Clarifications (revealed only if asked)</h2>
        <ul>
          {problem.clarifications.map((item) => (
            <li key={item.q}>
              {item.q} — {item.a}
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Design">
        <h2>High-level design</h2>
        <p>
          Draw on the <Link href="/design">canvas</Link>, then paste the topology here.
        </p>
      </section>
      <GradeForm rubric={problem.rubric} scenarios={problem.scenarios} />
    </main>
  );
}
