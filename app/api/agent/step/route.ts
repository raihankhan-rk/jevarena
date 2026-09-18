import { NextResponse } from "next/server";

import type { AgentStepRequest } from "@/lib/arena/types";
import { chooseArenaAction } from "@/lib/server/jev";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAgentStepRequest(value: unknown): value is AgentStepRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Partial<AgentStepRequest>;

  return (
    (request.agent === "Jev A" || request.agent === "Jev B") &&
    (request.game === "whack-a-mole" || request.game === "memory-match") &&
    typeof request.goal === "string" &&
    !!request.page &&
    typeof request.page.visibleText === "string" &&
    Array.isArray(request.elements) &&
    request.elements.length > 0 &&
    request.elements.length <= 24 &&
    request.elements.every(
      (element) =>
        typeof element?.id === "string" &&
        Number.isInteger(element.index) &&
        element.role === "button" &&
        typeof element.label === "string",
    ) &&
    !!request.memory &&
    Array.isArray(request.history) &&
    request.history.length <= 10
  );
}

export async function POST(incoming: Request) {
  let body: unknown;
  try {
    body = await incoming.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isAgentStepRequest(body)) {
    return NextResponse.json(
      { error: "Invalid indexed browser snapshot." },
      { status: 400 },
    );
  }

  const decision = await chooseArenaAction(body);
  return NextResponse.json(decision, {
    headers: { "Cache-Control": "no-store" },
  });
}
