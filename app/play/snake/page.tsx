import { SnakeGame } from "@/components/snake-game";
import type { PlayerId } from "@/lib/arena/types";

export const dynamic = "force-dynamic";

export default async function SnakePage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string; seed?: string }>;
}) {
  const query = await searchParams;
  const agentId: PlayerId = query.agent === "jev-b" ? "jev-b" : "jev-a";
  const seed = (query.seed ?? `snake-${agentId}`).slice(0, 80);

  return <SnakeGame agentId={agentId} seed={seed} />;
}
