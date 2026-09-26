import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { FixitLab } from "../../../components/fixit-lab";
import { meltingApi } from "../../../../../content/fixits/melting-api";
import { lonelyDatabase } from "../../../../../content/fixits/lonely-database";
import { openFloodgate } from "../../../../../content/fixits/open-floodgate";

const FIXITS = [meltingApi, lonelyDatabase, openFloodgate];

export function generateStaticParams(): { slug: string }[] {
  return FIXITS.map((fixit) => ({ slug: fixit.id }));
}

export default function FixitPage({ params }: { params: { slug: string } }): ReactElement {
  const fixit = FIXITS.find((candidate) => candidate.id === params.slug);
  if (fixit === undefined) notFound();
  return (
    <main>
      <p className="mt-8 font-mono text-sm text-smoke">fix-it</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{fixit.title}</h1>
      <FixitLab fixit={fixit} />
    </main>
  );
}
