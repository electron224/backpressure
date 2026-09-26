import { DesignCanvas } from "../../components/design-canvas";
import { PublishContext } from "../../components/assistant-store";

export default function DesignPage(): JSX.Element {
  return (
    <main>
      <p className="mt-8 font-mono text-sm text-smoke">01 Draw</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Design canvas</h1>
      <p className="mt-3 max-w-2xl leading-relaxed">Constrained palette: every node simulates. Draw, connect, run.</p>
      <PublishContext context={{ kind: "design", slug: "design", title: "Design canvas", summary: "Free-form canvas with constrained simulatable palette and run." }} />
      <DesignCanvas />
    </main>
  );
}
