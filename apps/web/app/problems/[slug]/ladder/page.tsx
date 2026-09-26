import Link from "next/link";
import type { ReactElement } from "react";
import { getProblem } from "../../../../lib/problems";
import { ScaleLadder } from "../../../../components/scale-ladder";

export function generateStaticParams(): { slug: string }[] {
  return [{ slug: "design-url-shortener" }, { slug: "design-twitter" }];
}

export default async function LadderPage({ params }: { params: { slug: string } }): Promise<ReactElement> {
  const problem = getProblem(params.slug);
  return (
    <main>
      <p className="mt-8 font-mono text-sm text-smoke">Scale ladder</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{problem.meta.title}: scale ladder</h1>
      <p className="mt-3 max-w-2xl leading-relaxed">
        Same design, three traffic checkpoints. Carry your topology forward and evolve it — or watch growth decide
        for you. Back to the <Link href={`/problems/${params.slug}`} className="hover:text-ember">interview</Link>.
      </p>
      <ScaleLadder slug={params.slug} rubric={problem.rubric} scenarios={problem.scenarios} />
    </main>
  );
}
