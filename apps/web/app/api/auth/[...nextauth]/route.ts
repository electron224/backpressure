import { handlers } from "../../../../auth";

// Explicit wrappers (not `export const { GET, POST } = handlers`): the dev
// router only registers statically obvious handler exports, and the
// destructured form 404s in `next dev` while the production build accepts it.
export function GET(...args: Parameters<typeof handlers.GET>): ReturnType<typeof handlers.GET> {
  return handlers.GET(...args);
}

export function POST(...args: Parameters<typeof handlers.POST>): ReturnType<typeof handlers.POST> {
  return handlers.POST(...args);
}
