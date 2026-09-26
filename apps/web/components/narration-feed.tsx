// apps/web/components/narration-feed.tsx

export function NarrationFeed({ narration }: { narration: string }): JSX.Element {
  const segments = narration
    .split("|")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  return (
    <dl className="space-y-1">
      {segments.map((segment) => {
        const colon = segment.indexOf(":");
        if (colon === -1) {
          return (
            <div key={segment}>
              <dd>{segment}</dd>
            </div>
          );
        }
        return (
          <div key={segment}>
            <dt className="inline font-bold">{segment.slice(0, colon)}: </dt>
            <dd className="inline">{segment.slice(colon + 1).trim()}</dd>
          </div>
        );
      })}
    </dl>
  );
}
