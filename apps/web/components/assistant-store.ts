// apps/web/components/assistant-store.ts
// Tiny page-context bus: pages publish what the learner is looking at so
// the sidebar assistant can ground answers without screenshots.
"use client";

import { useEffect, useState } from "react";

export interface PageContext {
  kind: string;
  slug: string;
  title: string;
  summary: string;
}

let current: PageContext | null = null;
const listeners = new Set<(context: PageContext | null) => void>();

function emit(): void {
  for (const listener of listeners) listener(current);
}

export function publishPageContext(context: PageContext | null): void {
  current = context;
  emit();
}

export function usePageContext(): PageContext | null {
  const [context, setContext] = useState<PageContext | null>(current);
  useEffect(() => {
    setContext(current);
    const listener = (next: PageContext | null): void => setContext(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return context;
}

export function PublishContext({ context }: { context: PageContext }): null {
  useEffect(() => {
    publishPageContext(context);
    return () => publishPageContext(null);
  }, [context.slug, context.kind, context.title, context.summary]);
  return null;
}
