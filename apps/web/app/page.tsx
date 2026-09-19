import Link from "next/link";

export default function Home(): JSX.Element {
  return (
    <main>
      <h1>Backpressure</h1>
      <p>Learn system design by running it.</p>
      <Link href="/concepts/load-balancing">Load Balancing</Link>
    </main>
  );
}
