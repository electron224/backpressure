// apps/web/components/sign-in-button.tsx
"use client";

import { signIn } from "next-auth/react";

export function SignInButton(): JSX.Element {
  return (
    <button
      type="button"
      className="mt-3 border border-ember bg-ember px-4 py-2 min-h-[44px] text-paper"
      onClick={() => void signIn("github", { callbackUrl: "/" })}
    >
      Sign in with GitHub
    </button>
  );
}
