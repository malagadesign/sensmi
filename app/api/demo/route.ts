import { NextRequest, NextResponse } from "next/server";

import { buildDemoPayload } from "@/lib/demo";
import type { DemoRangePreset } from "@/lib/demo-sensmi";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const deviceId = searchParams.get("deviceId");
  const range = (searchParams.get("range") ?? "7d") as DemoRangePreset;

  const payload = await buildDemoPayload({
    deviceId,
    range,
  });

  return NextResponse.json(payload, {
    status: payload.connection.status === "ok" ? 200 : 502,
  });
}
