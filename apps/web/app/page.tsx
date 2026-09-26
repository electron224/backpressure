import Link from "next/link";
import { getConcept } from "../lib/content";
import { TRACKS } from "../lib/tracks";
import { HeroDemo } from "../components/hero-demo";
import { TrackList } from "../components/track-list";
import type { TrackView } from "../components/track-list";

export default function Home(): JSX.Element {
  const tracks: TrackView[] = TRACKS.map((track) => ({
    ...track,
    concepts: track.slugs.map((slug) => {
      const concept = getConcept(slug);
      return { slug, title: concept.meta.title, prerequisites: concept.meta.prerequisites };
    }),
  }));
  return (
    <main>
      <p className="mt-8 font-mono text-sm text-smoke">simulate, observe, explain</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Learn system design by running it.</h1>
      <p className="mt-3 max-w-2xl leading-relaxed">
        Each lab is a real simulation, not an animation. Move traffic, break things, predict the numbers, then watch
        what actually happens. Start at Tier 1 and work down — every track assumes the ones above it.
      </p>
      <HeroDemo />
      <TrackList tracks={tracks} />
      <h2 className="mt-10 border-t border-ink/20 pt-4 text-xl font-bold">Design interviews</h2>
      <p className="mt-3">
        Finish Tier 2 first — interviews assume it. Then{" "}
        <Link href="/design" className="hover:text-ember">
          open the design canvas
        </Link>
        ,{" "}
        <Link href="/problems/design-url-shortener" className="hover:text-ember">
          take the URL shortener interview
        </Link>
        , or check your <Link href="/progress" className="hover:text-ember">progress</Link>.
      </p>
    </main>
  );
}
