import Link from "next/link";
import { getConcept } from "../lib/content";
import { presetSlugs } from "../lib/presets";

export default function Home(): JSX.Element {
  const concepts = presetSlugs().map((slug) => {
    const concept = getConcept(slug);
    return { slug, title: concept.meta.title };
  });
  return (
    <main>
      <p className="mt-8 font-mono text-sm text-smoke">simulate, observe, explain</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Learn system design by running it.</h1>
      <p className="mt-3 max-w-2xl leading-relaxed">
        Each lab is a real simulation, not an animation. Move traffic, break things, predict the numbers, then watch
        what actually happens.
      </p>
      <h2 className="mt-10 border-t border-ink/20 pt-4 text-xl font-bold">Concept labs</h2>
      <ul className="mt-3 grid gap-x-8 gap-y-1 sm:grid-cols-2">
        {concepts.map((concept, index) => (
          <li key={concept.slug} className="border-b border-ink/10 py-2">
            <Link href={`/concepts/${concept.slug}`} className="hover:text-ember">
              <span className="mr-3 font-mono text-sm text-smoke">{String(index + 1).padStart(2, "0")}</span>
              {concept.title}
            </Link>
          </li>
        ))}
      </ul>
      <h2 className="mt-10 border-t border-ink/20 pt-4 text-xl font-bold">Design interviews</h2>
      <p className="mt-3">
        <Link href="/design" className="hover:text-ember">
          Open the design canvas
        </Link>{" "}
        or{" "}
        <Link href="/problems/design-url-shortener" className="hover:text-ember">
          take the URL shortener interview
        </Link>
        .
      </p>
    </main>
  );
}
