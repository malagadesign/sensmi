import { NextResponse } from "next/server";

import { runSensmiTelemetryTest } from "@/lib/sensmi-telemetry-test";
import { SensmiError } from "@/lib/sensmi";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await runSensmiTelemetryTest();
    const status =
      result.connection.status === "error"
        ? 401
        : result.success
          ? 200
          : 502;

    return NextResponse.json(result, { status });
  } catch (error) {
    const message =
      error instanceof SensmiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Error inesperado ejecutando la prueba de telemetría";

    console.error("[Sensmi] Telemetry test route error:", message);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
