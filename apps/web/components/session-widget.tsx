import Link from "next/link";
import type { ReactElement } from "react";
import { auth, signOut } from "../auth";

export async function SessionWidget(): Promise<ReactElement> {
  const session = await auth();
  if (!session?.user) {
    return (
      <Link href="/login" className="font-mono text-sm hover:text-ember">
        sign in
      </Link>
    );
  }
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
      className="flex items-center gap-3"
    >
      <span className="font-mono text-sm text-onmasthead/70">{session.user.email ?? "you"}</span>
      <button type="submit" className="font-mono text-sm hover:text-ember">
        sign out
      </button>
    </form>
  );
}
