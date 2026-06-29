import { NextResponse } from "next/server";

import type { DemoContextResult } from "@/lib/demo-context";
import { buildDemoInsights } from "@/lib/demo-insights";
import type { DemoLocation } from "@/lib/demo-locations";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      metrics?: {
        totalInteractions: number;
        engagementTotal: number;
        telemetryPointCount: number;
        sensorStatus: "Activo" | "Inactivo" | "Desconocido";
        lastRssi: number | null;
      };
      context?: DemoContextResult;
      location?: DemoLocation;
    };

    if (!body.metrics || !body.context || !body.location) {
      return NextResponse.json(
        { error: "metrics, context y location son requeridos" },
        { status: 400 },
      );
    }

    const insights = buildDemoInsights({
      metrics: body.metrics,
      context: body.context,
      location: body.location,
    });

    return NextResponse.json(insights);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error generando insights",
      },
      { status: 500 },
    );
  }
}
