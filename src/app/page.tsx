import { PlayerConsole } from "@/components/player-console";

export default function Home() {
  return (
    <main className="ferro-shell min-h-screen">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="ferro-glow" />
        <div className="ferro-grid" />
      </div>
      <PlayerConsole />
    </main>
  );
}
