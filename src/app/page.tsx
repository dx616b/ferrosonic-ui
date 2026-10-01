import { PlayerConsole } from "@/components/player-console";

export default function Home() {
  return (
    <main className="ferro-shell min-h-screen">
      <div className="ferro-glow" aria-hidden />
      <div className="ferro-grid" aria-hidden />
      <PlayerConsole />
    </main>
  );
}
