// apps/web/lib/references.ts
import type { Topology } from "@backpressure/concept-engine";
import { LabPresetSchema } from "@backpressure/concept-engine";
import { v1Single as urlShortenerV1 } from "../../../content/problems/design-url-shortener/reference/v1-single.js";
import { v2Scaled as urlShortenerV2 } from "../../../content/problems/design-url-shortener/reference/v2-scaled.js";
import { v1Naive as twitterV1 } from "../../../content/problems/design-twitter/reference/v1-naive.js";
import { v2Scaled as twitterV2 } from "../../../content/problems/design-twitter/reference/v2-scaled.js";
import { v1SingleOrigin as videoV1 } from "../../../content/problems/design-video/reference/v1-single-origin.js";
import { v2Cdn as videoV2 } from "../../../content/problems/design-video/reference/v2-cdn.js";
import { v1Single as chatV1 } from "../../../content/problems/design-chat/reference/v1-single.js";
import { v2Queued as chatV2 } from "../../../content/problems/design-chat/reference/v2-queued.js";
import { v1Single as dropboxV1 } from "../../../content/problems/design-dropbox/reference/v1-single.js";
import { v2Replicated as dropboxV2 } from "../../../content/problems/design-dropbox/reference/v2-replicated.js";

export interface ReferenceArchitecture {
  id: string;
  label: string;
  topology: Topology;
}

// Reference architectures per problem, statically imported so
// the diff works at build time and never reads the FS at runtime.
// LabPresetSchema.parse validates the content files into the
// typed Topology (the raw exports infer kind as plain string).
// Each problem ships two scale points: a naive baseline and the
// scaled target — the learner sees both trade-off forks.
function reference(
  preset: unknown,
  label: string,
): ReferenceArchitecture {
  const parsed = LabPresetSchema.parse(preset);
  return { id: parsed.id, label, topology: parsed.topology };
}

const REFERENCES: Record<string, ReferenceArchitecture[]> = {
  "design-url-shortener": [
    reference(urlShortenerV1, "v1: single service"),
    reference(urlShortenerV2, "v2: limiter + cache + two services"),
  ],
  "design-twitter": [reference(twitterV1, "v1: naive"), reference(twitterV2, "v2: scaled")],
  "design-video": [reference(videoV1, "v1: single origin"), reference(videoV2, "v2: CDN")],
  "design-chat": [reference(chatV1, "v1: single"), reference(chatV2, "v2: queued")],
  "design-dropbox": [reference(dropboxV1, "v1: single"), reference(dropboxV2, "v2: replicated")],
};

export function getReferences(slug: string): ReferenceArchitecture[] {
  return REFERENCES[slug] ?? [];
}
