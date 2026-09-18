import { NextResponse } from "next/server";

import {
  getFightCount,
  incrementFightCount,
} from "@/lib/server/fight-counter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    return NextResponse.json(await getFightCount(), { headers });
  } catch {
    return NextResponse.json(
      { error: "Fight counter unavailable." },
      { status: 503, headers },
    );
  }
}

export async function POST() {
  try {
    return NextResponse.json(await incrementFightCount(), { headers });
  } catch {
    return NextResponse.json(
      { error: "Fight counter unavailable." },
      { status: 503, headers },
    );
  }
}
