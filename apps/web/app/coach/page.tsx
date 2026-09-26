import type { ReactElement } from "react";
import { CoachLab } from "../../components/coach-lab";

export default function CoachPage(): ReactElement {
  return (
    <main>
      <p className="mt-8 font-mono text-sm text-smoke">grounded critique</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Coach</h1>
      <p className="mt-3 max-w-2xl leading-relaxed">
        Paste any architecture, run it, then ask for critique. The coach explains your numbers and probes your
        trade-offs — it never scores; the simulator already did.
      </p>
      <CoachLab />
    </main>
  );
}
