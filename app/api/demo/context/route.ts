import { NextRequest, NextResponse } from "next/server";

import { fetchDemoContext } from "@/lib/demo-context";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const latitude = Number(searchParams.get("latitude"));
  const longitude = Number(searchParams.get("longitude"));
  const countryCode = searchParams.get("countryCode") ?? "AR";

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json(
      { error: "latitude y longitude son requeridos" },
      { status: 400 },
    );
  }

  const context = await fetchDemoContext({
    latitude,
    longitude,
    countryCode,
  });

  return NextResponse.json(context);
}
