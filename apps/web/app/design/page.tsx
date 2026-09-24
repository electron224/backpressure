import { DesignCanvas } from "../../components/design-canvas";

export default function DesignPage(): JSX.Element {
  return (
    <main>
      <h1>Design canvas</h1>
      <p>Constrained palette: every node simulates. Draw, connect, run.</p>
      <DesignCanvas />
    </main>
  );
}
