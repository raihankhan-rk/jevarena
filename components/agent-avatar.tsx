import type { PlayerId } from "@/lib/arena/types";

export function AgentAvatar({
  agentId,
  size = "regular",
}: {
  agentId: PlayerId;
  size?: "small" | "regular" | "large";
}) {
  const parallel = agentId === "jev-b";
  return (
    <span
      className={`snake-avatar avatar-${agentId} avatar-${size}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64">
        <rect x="7" y="7" width="50" height="50" rx="17" />
        <path d={parallel ? "M20 35c5 8 19 8 24 0" : "M20 38c6 5 18 5 24 0"} />
        <circle cx="23" cy="27" r="4" />
        <circle cx="41" cy="27" r="4" />
        {parallel && <path d="M13 16 3 7m48 9 10-9" />}
      </svg>
    </span>
  );
}
