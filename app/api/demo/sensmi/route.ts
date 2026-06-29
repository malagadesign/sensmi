import { NextRequest, NextResponse } from "next/server";

import { fetchDemoSensmiData, type DemoRangePreset } from "@/lib/demo-sensmi";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const deviceId = searchParams.get("deviceId");
  const range = (searchParams.get("range") ?? "7d") as DemoRangePreset;

  const data = await fetchDemoSensmiData({ deviceId, range });
  return NextResponse.json(data, {
    status: data.connection.status === "ok" ? 200 : 502,
  });
}
