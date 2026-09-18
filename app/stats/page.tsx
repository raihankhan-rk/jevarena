import Link from "next/link";

import { getFightCount } from "@/lib/server/fight-counter";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const counter = await getFightCount();
  const durable = counter.persistence === "volume";

  return (
    <main className="stats-page">
      <div className="stats-card">
        <span>JEVARENA / ANONYMOUS COUNTER</span>
        <h1>Fights started:</h1>
        <strong>{counter.fights.toLocaleString("en-US")}</strong>
        <p>
          {durable
            ? "Durable Railway Volume storage is active."
            : "Temporary storage is active. Mount a Railway Volume at /data to preserve this count across deploys."}
        </p>
        <Link href="/">← Back to JevArena</Link>
      </div>
    </main>
  );
}
