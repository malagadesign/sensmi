import { NextResponse } from "next/server";

import { runSensmiIntegrationTest } from "@/lib/sensmi-test";
import { SensmiError } from "@/lib/sensmi";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await runSensmiIntegrationTest();
    const status = result.success ? 200 : result.login.status === "error" ? 401 : 502;

    return NextResponse.json(result, { status });
  } catch (error) {
    const message =
      error instanceof SensmiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Error inesperado ejecutando la prueba de integración";

    console.error("[Sensmi] Test route error:", message);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
