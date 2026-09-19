import { compileMDX } from "next-mdx-remote/rsc";
import { ConceptLab } from "../../../components/concept-lab";
import { getConcept } from "../../../lib/content";

export function generateStaticParams(): { slug: string }[] {
  return [{ slug: "load-balancing" }];
}

export default async function ConceptPage({ params }: { params: { slug: string } }): Promise<JSX.Element> {
  const concept = getConcept(params.slug);
  const { content } = await compileMDX({ source: concept.learnMdx });
  return (
    <main>
      <h1>{concept.meta.title}</h1>
      <section aria-label="Learn">{content}</section>
      <ConceptLab slug={concept.meta.id} challenges={concept.challenges} recall={concept.recall} />
    </main>
  );
}
