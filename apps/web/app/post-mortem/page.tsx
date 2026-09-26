import type { ReactElement } from "react";
import { PostMortem } from "../../components/post-mortem";
import { parseIncident } from "../../lib/postmortems";
import { fridayDeploy } from "../../../../content/postmortems/friday-deploy";
import { flakyFriday } from "../../../../content/postmortems/flaky-friday";

export default function PostMortemPage(): ReactElement {
  return (
    <main>
      <p className="mt-8 font-mono text-sm text-smoke">01 Diagnose</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Failure post-mortem</h1>
      <p className="mt-3 max-w-2xl leading-relaxed">
        A production incident, real numbers, no answers given. Diagnose the root cause, then prove your fix
        re-running the same traffic.
      </p>
      <PostMortem incidents={[parseIncident(fridayDeploy), parseIncident(flakyFriday)]} />
    </main>
  );
}
