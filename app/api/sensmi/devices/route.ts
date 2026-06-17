import { NextResponse } from "next/server";

import { listDashboardDevices } from "@/lib/sensmi-dashboard";
import { SensmiError } from "@/lib/sensmi";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const devices = await listDashboardDevices();
    return NextResponse.json({ devices });
  } catch (error) {
    const message =
      error instanceof SensmiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Error listando devices";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
