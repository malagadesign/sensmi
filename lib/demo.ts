import { fetchDemoContext } from "./demo-context";
import { buildDemoInsights } from "./demo-insights";
import { fetchDemoSensmiData, type DemoRangePreset } from "./demo-sensmi";

export async function buildDemoPayload(params: {
  deviceId?: string | null;
  range?: DemoRangePreset;
}) {
  const sensmi = await fetchDemoSensmiData(params);

  if (!sensmi.device || !sensmi.metrics || !sensmi.location) {
    return {
      ...sensmi,
      context: null,
      insights: null,
    };
  }

  const context = await fetchDemoContext({
    latitude: sensmi.location.latitude,
    longitude: sensmi.location.longitude,
    countryCode: sensmi.location.countryCode,
  });

  const insights = buildDemoInsights({
    metrics: {
      totalInteractions: sensmi.metrics.totalInteractions,
      engagementTotal: sensmi.metrics.engagementTotal,
      telemetryPointCount: sensmi.metrics.telemetryPointCount,
      sensorStatus: sensmi.metrics.sensorStatus,
      lastRssi: sensmi.metrics.lastRssi,
    },
    context,
    location: sensmi.location,
  });

  return {
    device: sensmi.device,
    devices: sensmi.devices,
    location: sensmi.location,
    metrics: sensmi.metrics,
    context,
    insights,
    dictionary: sensmi.dictionary,
    connection: sensmi.connection,
    range: sensmi.range,
    updatedAt: sensmi.connection.updatedAt,
    debug: {
      ...sensmi.debug,
      externalErrors: context.errors,
    },
  };
}
