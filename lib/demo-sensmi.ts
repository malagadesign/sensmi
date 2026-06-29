import { resolveDemoLocation, type DemoLocation } from "./demo-locations";
import {
  fetchDashboardData,
  getFriendlySensmiLabel,
  listDashboardDevices,
  MS_24H,
  MS_30D,
  MS_7D,
  type DashboardDevice,
  type DictionaryEntry,
  type SensmiKeyCategory,
} from "./sensmi-dashboard";
import { sensmiLogin, SensmiError } from "./sensmi";

export type DemoRangePreset = "24h" | "7d" | "30d";

export interface DemoDevice extends DashboardDevice {
  customer?: string | null;
}

export interface DemoMetrics {
  totalInteractions: number;
  engagementTotal: number;
  telemetryPointCount: number;
  activitySeries: Array<{ ts: number; value: number }>;
  totalsByKey: Record<string, number>;
  totalsByCategory: Partial<Record<SensmiKeyCategory, number>>;
  lastActivityTime: number | null;
  sensorStatus: "Activo" | "Inactivo" | "Desconocido";
  lastRssi: number | null;
}

export interface DemoSensmiResult {
  connection: {
    status: "ok" | "error";
    message: string;
    updatedAt: string;
  };
  devices: DemoDevice[];
  selectedDeviceId: string | null;
  device: DemoDevice | null;
  location: DemoLocation;
  metrics: DemoMetrics | null;
  dictionary: DictionaryEntry[];
  range: {
    preset: DemoRangePreset;
    startTs: number;
    endTs: number;
  };
  debug: Record<string, unknown>;
}

export function getRangeTimestamps(preset: DemoRangePreset): {
  startTs: number;
  endTs: number;
} {
  const endTs = Date.now();
  if (preset === "24h") return { startTs: endTs - MS_24H, endTs };
  if (preset === "30d") return { startTs: endTs - MS_30D, endTs };
  return { startTs: endTs - MS_7D, endTs };
}

export function selectRecommendedDevice(
  devices: DemoDevice[],
): DemoDevice | null {
  if (devices.length === 0) return null;

  const active = devices.find(
    (device) =>
      device.active === true ||
      device.active === "true" ||
      device.active === 1 ||
      device.active === "1",
  );
  if (active) return active;

  const withActivity = [...devices]
    .filter((device) => device.lastActivityTime)
    .sort(
      (a, b) => (b.lastActivityTime ?? 0) - (a.lastActivityTime ?? 0),
    );
  if (withActivity[0]) return withActivity[0];

  return devices[0];
}

async function enrichDevicesWithCustomer(
  devices: DashboardDevice[],
): Promise<DemoDevice[]> {
  return devices.map((device) => ({ ...device, customer: null }));
}

export async function fetchDemoSensmiData(params: {
  deviceId?: string | null;
  range?: DemoRangePreset;
}): Promise<DemoSensmiResult> {
  const rangePreset = params.range ?? "7d";
  const { startTs, endTs } = getRangeTimestamps(rangePreset);
  const updatedAt = new Date().toISOString();

  try {
    await sensmiLogin();
  } catch (error) {
    return {
      connection: {
        status: "error",
        message:
          error instanceof SensmiError
            ? error.message
            : "No se pudo conectar con Sensmi",
        updatedAt,
      },
      devices: [],
      selectedDeviceId: null,
      device: null,
      location: resolveDemoLocation("", ""),
      metrics: null,
      dictionary: [],
      range: { preset: rangePreset, startTs, endTs },
      debug: { error: error instanceof Error ? error.message : "Login error" },
    };
  }

  const baseDevices = await listDashboardDevices();
  const devices = await enrichDevicesWithCustomer(baseDevices);
  const recommended = selectRecommendedDevice(devices);
  const selected =
    devices.find((device) => device.id === params.deviceId) ??
    recommended ??
    null;

  if (!selected) {
    return {
      connection: {
        status: "error",
        message: "No hay devices disponibles en Sensmi",
        updatedAt,
      },
      devices,
      selectedDeviceId: null,
      device: null,
      location: resolveDemoLocation("", ""),
      metrics: null,
      dictionary: [],
      range: { preset: rangePreset, startTs, endTs },
      debug: {},
    };
  }

  const dashboard = await fetchDashboardData({
    deviceId: selected.id,
    startTs,
    endTs,
    agg: "SUM",
    interval: rangePreset === "24h" ? 3_600_000 : 86_400_000,
  });

  const customer =
    typeof dashboard.attributesNormalized.Customer === "string"
      ? dashboard.attributesNormalized.Customer
      : dashboard.attributesNormalized.Customer != null
        ? String(dashboard.attributesNormalized.Customer)
        : null;

  const device: DemoDevice = {
    ...dashboard.device,
    customer,
  };

  const metrics: DemoMetrics = {
    totalInteractions: dashboard.businessSummary.totalInteractions,
    engagementTotal: dashboard.debug.totalsByCategory.Engagement ?? 0,
    telemetryPointCount: dashboard.debug.meta.pointCount,
    activitySeries: dashboard.activitySeries,
    totalsByKey: dashboard.debug.totalsByKey,
    totalsByCategory: dashboard.debug.totalsByCategory,
    lastActivityTime: dashboard.businessSummary.lastActivityTime,
    sensorStatus: dashboard.businessSummary.sensorStatus,
    lastRssi: dashboard.businessSummary.lastRssi,
  };

  return {
    connection: {
      status: "ok",
      message: "Conectado a Sensmi Platform API",
      updatedAt,
    },
    devices: devices.map((item) =>
      item.id === device.id ? device : item,
    ),
    selectedDeviceId: device.id,
    device,
    location: resolveDemoLocation(device.id, device.name),
    metrics,
    dictionary: dashboard.dictionary,
    range: { preset: rangePreset, startTs, endTs },
    debug: {
      selectedKeys: dashboard.debug.selectedKeys,
      attributesNormalized: dashboard.attributesNormalized,
      totalsByKey: dashboard.debug.totalsByKey,
      totalsByCategory: dashboard.debug.totalsByCategory,
      meta: dashboard.debug.meta,
      rawSummary: {
        keys: dashboard.debug.selectedKeys.length,
        events: dashboard.debug.meta.pointCount,
      },
    },
  };
}

export { getFriendlySensmiLabel } from "./sensmi-dashboard";
export { classifySensmiKey } from "./sensmi-dashboard";
