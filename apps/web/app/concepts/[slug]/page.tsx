import { compileMDX } from "next-mdx-remote/rsc";
import { ConceptLab } from "../../../components/concept-lab";
import { ConceptNav } from "../../../components/concept-nav";
import { PublishContext } from "../../../components/assistant-store";
import { getConcept } from "../../../lib/content";
import { getPreset, presetSlugs } from "../../../lib/presets";
import { nextAfter } from "../../../lib/tracks";

export function generateStaticParams(): { slug: string }[] {
  return presetSlugs().map((slug) => ({ slug }));
}

export default async function ConceptPage({ params }: { params: { slug: string } }): Promise<JSX.Element> {
  const concept = getConcept(params.slug);
  const { content } = await compileMDX({ source: concept.learnMdx });
  const following = nextAfter(params.slug);
  const next = following === null ? null : { slug: following.slug, title: getConcept(following.slug).meta.title };
  return (
    <main>
      <p className="mt-8 font-mono text-sm text-smoke">01 Learn</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{concept.meta.title}</h1>
      <section aria-label="Learn">
        <div className="prose mt-4 max-w-2xl leading-relaxed dark:prose-invert">{content}</div>
      </section>
      <PublishContext context={{ kind: "concept", slug: params.slug, title: concept.meta.title, summary: `Four-stage lab: learn, play, predict, chaos, stress, recall.` }} />
      <ConceptNav slug={params.slug} prerequisites={concept.meta.prerequisites} next={next} />
      <ConceptLab slug={concept.meta.id} preset={getPreset(concept.meta.id)} challenges={concept.challenges} recall={concept.recall} />
    </main>
  );
}
