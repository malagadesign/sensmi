import { NextRequest, NextResponse } from "next/server";

import { fetchDashboardData } from "@/lib/sensmi-dashboard";
import { SensmiError } from "@/lib/sensmi";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const deviceId = searchParams.get("deviceId");
  const startTs = Number(searchParams.get("startTs"));
  const endTs = Number(searchParams.get("endTs"));
  const agg = searchParams.get("agg") ?? undefined;
  const intervalParam = searchParams.get("interval");
  const interval = intervalParam ? Number(intervalParam) : undefined;

  if (!deviceId) {
    return NextResponse.json(
      { error: "deviceId es requerido" },
      { status: 400 },
    );
  }

  if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) {
    return NextResponse.json(
      { error: "startTs y endTs son requeridos" },
      { status: 400 },
    );
  }

  try {
    const data = await fetchDashboardData({
      deviceId,
      startTs,
      endTs,
      agg: agg && agg !== "none" ? agg : undefined,
      interval: interval && interval > 0 ? interval : undefined,
    });

    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof SensmiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Error obteniendo datos del dashboard";

    const status =
      error instanceof SensmiError && error.status === 401 ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
