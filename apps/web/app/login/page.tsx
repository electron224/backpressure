import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { SignInButton } from "../../components/sign-in-button";

export default async function LoginPage(): Promise<ReactElement> {
  const session = await auth();
  if (session?.user) redirect("/progress");
  return (
    <main>
      <p className="mt-8 font-mono text-sm text-smoke">accounts</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-3 max-w-2xl leading-relaxed">
        Labs work anonymously with browser progress. Sign in to keep your progress, predictions, and interview
        transcripts across devices once server sync lands — today it reserves your account.
      </p>
      <SignInButton />
      <p className="mt-3 font-mono text-xs text-smoke">GitHub only for now. Email magic links land next.</p>
    </main>
  );
}
