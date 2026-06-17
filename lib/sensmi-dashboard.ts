import {
  buildListQuery,
  clearSensmiToken,
  dedupeKeys,
  extractPageData,
  getDeviceSummary,
  normalizeAttributes,
  type NormalizedAttributes,
  sensmiFetch,
  sensmiLogin,
  SensmiError,
} from "./sensmi";

export type SensmiKeyCategory =
  | "Engagement"
  | "RFID"
  | "DPU"
  | "DPB"
  | "Traffic"
  | "Convergence"
  | "OTS"
  | "XRDR / Sensor"
  | "Técnico"
  | "Otros";

export type SensmiKeySource = "XRDR" | "RFID" | "XY" | "unknown";

export type SensmiMetricType =
  | "DPU"
  | "DPB"
  | "Dwell"
  | "Traffic"
  | "Convergence"
  | "OTS"
  | "DA"
  | null;

export interface SensmiKeyMeta {
  rawKey: string;
  category: SensmiKeyCategory;
  source: SensmiKeySource;
  productOrZone: string | null;
  metricType: SensmiMetricType;
}

export interface FriendlyLabel {
  label: string;
  needsValidation: boolean;
}

export interface DashboardDevice {
  id: string;
  name: string;
  type: string;
  active: boolean | string | number | null;
  lastActivityTime: number | null;
}

export interface DashboardEvent {
  ts: number;
  key: string;
  value: unknown;
  category: SensmiKeyCategory;
}

export interface DashboardSeriesPoint {
  ts: number;
  value: number;
}

export interface DashboardDataParams {
  deviceId: string;
  startTs: number;
  endTs: number;
  agg?: string;
  interval?: number;
}

export interface DashboardRange {
  startTs: number;
  endTs: number;
  agg: string | null;
  interval: number | null;
}

export interface BusinessSummary {
  totalInteractions: number;
  activeZonesOrProducts: number;
  totalTraffic: number;
  convergenceValue: number | null;
  lastActivityTime: number | null;
  sensorStatus: "Activo" | "Inactivo" | "Desconocido";
  lastRssi: number | null;
}

export interface ActivitySeriesPoint {
  ts: number;
  value: number;
}

export interface TopZoneOrProduct {
  key: string;
  friendlyLabel: string;
  category: SensmiKeyCategory;
  total: number;
  pointCount: number;
  lastTs: number | null;
  needsValidation: boolean;
}

export interface CategorySummaryItem {
  category: SensmiKeyCategory;
  pointCount: number;
  totalValue: number;
  keyCount: number;
  lastTs: number | null;
}

export interface DictionaryEntry {
  technicalKey: string;
  friendlyLabel: string;
  category: SensmiKeyCategory;
  pointCount: number;
  totalValue: number;
  lastValue: unknown;
  lastTs: number | null;
  status: "Validar";
  needsValidation: boolean;
}

export interface DashboardDebug {
  meta: {
    startTs: number;
    endTs: number;
    agg: string | null;
    interval: number | null;
    pointCount: number;
  };
  selectedKeys: string[];
  raw: unknown;
  attributesNormalized: NormalizedAttributes;
  totalsByKey: Record<string, number>;
  totalsByCategory: Partial<Record<SensmiKeyCategory, number>>;
  events: DashboardEvent[];
  seriesByKey: Record<string, DashboardSeriesPoint[]>;
  seriesByCategory: Partial<Record<SensmiKeyCategory, DashboardSeriesPoint[]>>;
  warnings?: string[];
}

export interface DashboardDataResult {
  device: DashboardDevice;
  attributesNormalized: NormalizedAttributes;
  range: DashboardRange;
  businessSummary: BusinessSummary;
  activitySeries: ActivitySeriesPoint[];
  topZonesOrProducts: TopZoneOrProduct[];
  categoriesSummary: CategorySummaryItem[];
  dictionary: DictionaryEntry[];
  pendingDictionaryKeys: string[];
  debug: DashboardDebug;
}

const ATTRIBUTE_KEYS = [
  "DeviceName",
  "active",
  "lastActivityTime",
  "lastConnectTime",
  "lastDisconnectTime",
  "DeviceHealth",
  "DeviceHealthState",
] as const;

const KEYS_BATCH_SIZE = 12;

const ACTIVITY_CATEGORIES: SensmiKeyCategory[] = [
  "RFID",
  "DPU",
  "DPB",
  "XRDR / Sensor",
];

const ZONE_CATEGORIES: SensmiKeyCategory[] = [
  "RFID",
  "DPU",
  "DPB",
  "XRDR / Sensor",
];

const ALL_CATEGORIES: SensmiKeyCategory[] = [
  "Engagement",
  "RFID",
  "DPU",
  "DPB",
  "XRDR / Sensor",
  "Traffic",
  "Convergence",
  "OTS",
  "Técnico",
  "Otros",
];

const FRIENDLY_LABEL_MAP: Record<string, string> = {
  Engagement: "Interacción general",
  RFIDDDPU001: "Producto / Tag 001",
  RFIDDDPU002: "Producto / Tag 002",
  RFIDDDPU003: "Producto / Tag 003",
  RFIDDDPU004: "Producto / Tag 004",
  XRDR1P008DPU004: "Zona P008 · Producto 004 · DPU",
  XRDR1P008DPB004: "Zona P008 · Producto 004 · DPB",
  XRDR1P007DPU001: "Zona P007 · Producto 001 · DPU",
  XRDR1P007DPB001: "Zona P007 · Producto 001 · DPB",
  XRDR1P002DPU002: "Zona P002 · Producto 002 · DPU",
  XRDR1P002DPB002: "Zona P002 · Producto 002 · DPB",
  XRDR1P001DPU003: "Zona P001 · Producto 003 · DPU",
  XRDR1P001DPB003: "Zona P001 · Producto 003 · DPB",
  XY241P003DConvergence: "Sensor P003 · Convergencia",
  XY241P003DOTS: "Sensor P003 · OTS",
  XY241P003DTraffic: "Sensor P003 · Tráfico",
  XRDR1P7DA: "Sensor XRDR · Zona P7 · DA",
  rssi: "Señal del dispositivo",
};

export function classifySensmiKey(key: string): SensmiKeyCategory {
  if (key === "Engagement") return "Engagement";
  if (key.includes("RFID")) return "RFID";
  if (key.includes("DPU")) return "DPU";
  if (key.includes("DPB")) return "DPB";
  if (key.includes("Traffic")) return "Traffic";
  if (key.includes("Convergence")) return "Convergence";
  if (key.includes("OTS")) return "OTS";
  if (key.startsWith("XRDR") && !key.includes("DPU") && !key.includes("DPB")) {
    return "XRDR / Sensor";
  }
  if (key === "rssi") return "Técnico";
  if (
    key === "current_fw_title" ||
    key === "current_fw_version" ||
    key === "fw_state"
  ) {
    return "Técnico";
  }
  return "Otros";
}

function detectMetricType(key: string): SensmiMetricType {
  if (key.includes("DPU")) return "DPU";
  if (key.includes("DPB")) return "DPB";
  if (key.includes("Dwell")) return "Dwell";
  if (key.includes("Traffic")) return "Traffic";
  if (key.includes("Convergence")) return "Convergence";
  if (key.includes("OTS")) return "OTS";
  if (/DA$/i.test(key) && !key.includes("DPU")) return "DA";
  return null;
}

function detectSource(key: string): SensmiKeySource {
  if (key.startsWith("XRDR")) return "XRDR";
  if (key.includes("RFID")) return "RFID";
  if (key.startsWith("XY")) return "XY";
  return "unknown";
}

function extractProductOrZone(
  key: string,
  source: SensmiKeySource,
): string | null {
  if (source === "XRDR") {
    const match = key.match(/^XRDR\d*(P\d+)/i);
    if (match) return match[1];
  }
  if (source === "XY") {
    const match = key.match(/^XY\d*(P\d+)/i);
    if (match) return match[1];
  }
  if (source === "RFID") {
    const match = key.match(/(\d{3})$/);
    if (match) return `Tag ${match[1]}`;
  }
  return null;
}

export function extractSensmiKeyMeta(key: string): SensmiKeyMeta {
  const source = detectSource(key);
  return {
    rawKey: key,
    category: classifySensmiKey(key),
    source,
    productOrZone: extractProductOrZone(key, source),
    metricType: detectMetricType(key),
  };
}

function buildGeneratedFriendlyLabel(key: string, meta: SensmiKeyMeta): string {
  if (meta.source === "XY" && meta.productOrZone) {
    if (meta.metricType === "Convergence") {
      return `Sensor ${meta.productOrZone} · Convergencia`;
    }
    if (meta.metricType === "OTS") return `Sensor ${meta.productOrZone} · OTS`;
    if (meta.metricType === "Traffic") return `Sensor ${meta.productOrZone} · Tráfico`;
  }

  if (meta.source === "XRDR" && meta.productOrZone && meta.metricType) {
    const zone = meta.productOrZone;
    if (meta.metricType === "DA") {
      return `Sensor XRDR · Zona ${zone.replace(/^P/i, "")} · DA`;
    }
    const productMatch = key.match(/(\d{3})$/);
    const product = productMatch ? productMatch[1] : null;
    if (product) {
      return `Zona ${zone} · Producto ${product} · ${meta.metricType}`;
    }
    return `Sensor XRDR · ${zone} · ${meta.metricType}`;
  }

  if (meta.source === "RFID" && meta.productOrZone) {
    return `Producto / ${meta.productOrZone}`;
  }

  return key;
}

export function getFriendlySensmiLabel(key: string): FriendlyLabel {
  if (key in FRIENDLY_LABEL_MAP) {
    return {
      label: FRIENDLY_LABEL_MAP[key],
      needsValidation: key !== "Engagement" && key !== "rssi",
    };
  }

  const meta = extractSensmiKeyMeta(key);
  if (meta.category === "Otros") {
    return { label: key, needsValidation: true };
  }

  return {
    label: buildGeneratedFriendlyLabel(key, meta),
    needsValidation: true,
  };
}

export function isDashboardKey(key: string): boolean {
  return classifySensmiKey(key) !== "Otros";
}

function parseNumericValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function readTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function isActiveValue(active: unknown): boolean {
  return active === true || active === "true" || active === 1 || active === "1";
}

function selectDashboardKeys(allKeys: string[]): {
  selectedKeys: string[];
  pendingDictionaryKeys: string[];
} {
  const pendingDictionaryKeys = allKeys.filter(
    (key) => classifySensmiKey(key) === "Otros",
  );
  const selectedKeys = allKeys.filter(isDashboardKey);

  return {
    selectedKeys: selectedKeys.length > 0 ? selectedKeys : allKeys,
    pendingDictionaryKeys,
  };
}

interface ProcessedTimeseries {
  events: DashboardEvent[];
  totalsByKey: Record<string, number>;
  totalsByCategory: Partial<Record<SensmiKeyCategory, number>>;
  seriesByKey: Record<string, DashboardSeriesPoint[]>;
  seriesByCategory: Partial<Record<SensmiKeyCategory, DashboardSeriesPoint[]>>;
  lastRssi: number | null;
}

function processTimeseriesData(
  data: unknown,
  keys: string[],
): ProcessedTimeseries {
  const events: DashboardEvent[] = [];
  const totalsByKey: Record<string, number> = {};
  const totalsByCategory: Partial<Record<SensmiKeyCategory, number>> = {};
  const seriesByKey: Record<string, DashboardSeriesPoint[]> = {};
  const categoryBuckets = new Map<SensmiKeyCategory, Map<number, number>>();
  let lastRssi: number | null = null;
  let lastRssiTs = -1;

  if (!data || typeof data !== "object") {
    return {
      events,
      totalsByKey,
      totalsByCategory,
      seriesByKey,
      seriesByCategory: {},
      lastRssi: null,
    };
  }

  const record = data as Record<string, unknown>;

  for (const key of keys) {
    const points = record[key];
    if (!Array.isArray(points)) continue;

    const category = classifySensmiKey(key);
    totalsByKey[key] = 0;
    seriesByKey[key] = [];

    if (!categoryBuckets.has(category)) {
      categoryBuckets.set(category, new Map());
    }
    const bucket = categoryBuckets.get(category)!;

    for (const point of points) {
      if (!point || typeof point !== "object") continue;

      const pointRecord = point as Record<string, unknown>;
      const ts = typeof pointRecord.ts === "number" ? pointRecord.ts : 0;
      const numericValue = parseNumericValue(pointRecord.value);

      events.push({ ts, key, value: pointRecord.value, category });
      totalsByKey[key] += numericValue;
      totalsByCategory[category] =
        (totalsByCategory[category] ?? 0) + numericValue;
      seriesByKey[key].push({ ts, value: numericValue });
      bucket.set(ts, (bucket.get(ts) ?? 0) + numericValue);

      if (key === "rssi" && ts >= lastRssiTs) {
        lastRssiTs = ts;
        lastRssi = numericValue;
      }
    }

    seriesByKey[key].sort((a, b) => a.ts - b.ts);
  }

  events.sort((a, b) => b.ts - a.ts);

  const seriesByCategory: Partial<
    Record<SensmiKeyCategory, DashboardSeriesPoint[]>
  > = {};

  for (const [category, bucket] of categoryBuckets.entries()) {
    seriesByCategory[category] = Array.from(bucket.entries())
      .map(([ts, value]) => ({ ts, value }))
      .sort((a, b) => a.ts - b.ts);
  }

  return {
    events,
    totalsByKey,
    totalsByCategory,
    seriesByKey,
    seriesByCategory,
    lastRssi,
  };
}

export function calculateBusinessSummary(
  events: DashboardEvent[],
  attributesNormalized: NormalizedAttributes,
  totalsByKey: Record<string, number>,
  totalsByCategory: Partial<Record<SensmiKeyCategory, number>>,
  seriesByKey: Record<string, DashboardSeriesPoint[]>,
  lastRssi: number | null,
): BusinessSummary {
  const engagementEvents = events.filter((event) => event.key === "Engagement");
  const engagementTotal = totalsByKey.Engagement ?? 0;

  let totalInteractions = 0;
  if (engagementEvents.length > 0) {
    totalInteractions =
      engagementTotal > 0 ? engagementTotal : engagementEvents.length;
  } else {
    totalInteractions = events.filter((event) =>
      (["RFID", "DPU", "DPB"] as SensmiKeyCategory[]).includes(event.category),
    ).length;
  }

  const activeZonesOrProducts = Object.entries(seriesByKey).filter(
    ([key, series]) =>
      ZONE_CATEGORIES.includes(classifySensmiKey(key)) && series.length > 0,
  ).length;

  const convergenceSeries = Object.entries(seriesByKey).find(([key]) =>
    key.includes("Convergence"),
  );
  const convergenceValue = convergenceSeries
    ? (totalsByKey[convergenceSeries[0]] ??
      convergenceSeries[1][convergenceSeries[1].length - 1]?.value ??
      null)
    : (totalsByCategory.Convergence ?? null);

  const lastActivityTime = readTimestamp(attributesNormalized.lastActivityTime);

  let sensorStatus: BusinessSummary["sensorStatus"] = "Desconocido";
  if (attributesNormalized.active != null) {
    sensorStatus = isActiveValue(attributesNormalized.active)
      ? "Activo"
      : "Inactivo";
  }

  return {
    totalInteractions,
    activeZonesOrProducts,
    totalTraffic: totalsByCategory.Traffic ?? 0,
    convergenceValue:
      typeof convergenceValue === "number" ? convergenceValue : null,
    lastActivityTime,
    sensorStatus,
    lastRssi,
  };
}

export function buildActivitySeries(
  seriesByCategory: Partial<Record<SensmiKeyCategory, DashboardSeriesPoint[]>>,
  seriesByKey: Record<string, DashboardSeriesPoint[]>,
): ActivitySeriesPoint[] {
  const engagement =
    seriesByCategory.Engagement ?? seriesByKey.Engagement ?? [];

  if (
    engagement.length > 0 &&
    engagement.some((point) => point.value > 0)
  ) {
    return engagement.map((point) => ({
      ts: point.ts,
      value: point.value,
    }));
  }

  const bucket = new Map<number, number>();

  for (const category of ACTIVITY_CATEGORIES) {
    for (const point of seriesByCategory[category] ?? []) {
      bucket.set(point.ts, (bucket.get(point.ts) ?? 0) + point.value);
    }
  }

  return Array.from(bucket.entries())
    .map(([ts, value]) => ({ ts, value }))
    .sort((a, b) => a.ts - b.ts);
}

export function buildTopZonesOrProducts(
  keys: string[],
  totalsByKey: Record<string, number>,
  seriesByKey: Record<string, DashboardSeriesPoint[]>,
): TopZoneOrProduct[] {
  return keys
    .filter((key) => {
      const category = classifySensmiKey(key);
      return (
        category !== "Engagement" &&
        category !== "Técnico" &&
        category !== "Otros" &&
        (seriesByKey[key]?.length ?? 0) > 0
      );
    })
    .map((key) => {
      const series = seriesByKey[key] ?? [];
      const friendly = getFriendlySensmiLabel(key);
      const lastPoint = series[series.length - 1];

      return {
        key,
        friendlyLabel: friendly.label,
        category: classifySensmiKey(key),
        total: totalsByKey[key] ?? 0,
        pointCount: series.length,
        lastTs: lastPoint?.ts ?? null,
        needsValidation: friendly.needsValidation,
      };
    })
    .sort((a, b) => b.total - a.total || b.pointCount - a.pointCount);
}

function buildCategoriesSummary(
  keys: string[],
  totalsByKey: Record<string, number>,
  totalsByCategory: Partial<Record<SensmiKeyCategory, number>>,
  seriesByKey: Record<string, DashboardSeriesPoint[]>,
  events: DashboardEvent[],
): CategorySummaryItem[] {
  return ALL_CATEGORIES.map((category) => {
    const categoryKeys = keys.filter(
      (key) => classifySensmiKey(key) === category,
    );
    const pointCount = categoryKeys.reduce(
      (sum, key) => sum + (seriesByKey[key]?.length ?? 0),
      0,
    );
    const categoryEvents = events.filter((event) => event.category === category);

    return {
      category,
      pointCount,
      totalValue: totalsByCategory[category] ?? 0,
      keyCount: categoryKeys.length,
      lastTs: categoryEvents[0]?.ts ?? null,
    };
  }).filter(
    (item) => item.pointCount > 0 || item.keyCount > 0 || item.totalValue > 0,
  );
}

function buildDictionary(
  keys: string[],
  totalsByKey: Record<string, number>,
  seriesByKey: Record<string, DashboardSeriesPoint[]>,
  events: DashboardEvent[],
): DictionaryEntry[] {
  return keys
    .filter((key) => classifySensmiKey(key) !== "Otros")
    .map((key) => {
      const friendly = getFriendlySensmiLabel(key);
      const series = seriesByKey[key] ?? [];
      const lastEvent = events.find((event) => event.key === key);
      const lastPoint = series[series.length - 1];

      return {
        technicalKey: key,
        friendlyLabel: friendly.label,
        category: classifySensmiKey(key),
        pointCount: series.length,
        totalValue: totalsByKey[key] ?? 0,
        lastValue: lastEvent?.value ?? lastPoint?.value ?? null,
        lastTs: lastEvent?.ts ?? lastPoint?.ts ?? null,
        status: "Validar" as const,
        needsValidation: friendly.needsValidation,
      };
    })
    .sort((a, b) => b.pointCount - a.pointCount);
}

async function fetchTimeseriesBatched(
  deviceId: string,
  keys: string[],
  startTs: number,
  endTs: number,
  agg?: string,
  interval?: number,
): Promise<{ data: Record<string, unknown>; errors: string[] }> {
  const merged: Record<string, unknown> = {};
  const errors: string[] = [];

  for (let i = 0; i < keys.length; i += KEYS_BATCH_SIZE) {
    const batch = keys.slice(i, i + KEYS_BATCH_SIZE);
    const query = buildListQuery({
      keys: batch.join(","),
      startTs,
      endTs,
      limit: 5000,
      orderBy: "ASC",
      ...(agg && interval ? { agg, interval } : {}),
    });

    try {
      const batchData = await sensmiFetch(
        `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries${query}`,
      );

      if (batchData && typeof batchData === "object") {
        Object.assign(merged, batchData as Record<string, unknown>);
      }
    } catch (error) {
      errors.push(
        error instanceof SensmiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Error consultando timeseries",
      );
    }
  }

  return { data: merged, errors };
}

export async function listDashboardDevices(): Promise<DashboardDevice[]> {
  clearSensmiToken();
  await sensmiLogin();

  const devicesQuery = buildListQuery({ pageSize: 50, page: 0 });
  const devicesRaw = await sensmiFetch(`/api/user/devices${devicesQuery}`);
  const items = extractPageData(devicesRaw).items;
  const devices: DashboardDevice[] = [];

  for (const item of items) {
    const summary = getDeviceSummary(item);
    if (!summary) continue;

    let active: boolean | string | number | null = null;
    let lastActivityTime: number | null = null;

    try {
      const query = buildListQuery({ keys: "active,lastActivityTime" });
      const attrsRaw = await sensmiFetch(
        `/api/plugins/telemetry/DEVICE/${summary.id}/values/attributes${query}`,
      );
      const normalized = normalizeAttributes(attrsRaw);
      active = normalized.active ?? null;
      lastActivityTime = readTimestamp(normalized.lastActivityTime);
    } catch {
      // atributos opcionales para el listado
    }

    if (!lastActivityTime && item && typeof item === "object") {
      lastActivityTime = readTimestamp(
        (item as Record<string, unknown>).lastActivityTime,
      );
    }

    devices.push({ ...summary, active, lastActivityTime });
  }

  return devices;
}

export async function fetchDashboardData(
  params: DashboardDataParams,
): Promise<DashboardDataResult> {
  clearSensmiToken();
  await sensmiLogin();

  const { deviceId, startTs, endTs, agg, interval } = params;

  const devicesQuery = buildListQuery({ pageSize: 50, page: 0 });
  const devicesRaw = await sensmiFetch(`/api/user/devices${devicesQuery}`);
  const deviceItem = extractPageData(devicesRaw).items.find((item) => {
    const summary = getDeviceSummary(item);
    return summary?.id === deviceId;
  });

  const summary = deviceItem ? getDeviceSummary(deviceItem) : null;
  if (!summary) {
    throw new SensmiError(`Device no encontrado: ${deviceId}`);
  }

  const attrQuery = buildListQuery({ keys: ATTRIBUTE_KEYS.join(",") });
  const attributesRaw = await sensmiFetch(
    `/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes${attrQuery}`,
  );
  const attributesNormalized = normalizeAttributes(attributesRaw);

  const timeseriesKeysRaw = await sensmiFetch(
    `/api/plugins/telemetry/DEVICE/${deviceId}/keys/timeseries`,
  );
  const allKeys = dedupeKeys(timeseriesKeysRaw);
  const { selectedKeys, pendingDictionaryKeys } =
    selectDashboardKeys(allKeys);

  const { data, errors } = await fetchTimeseriesBatched(
    deviceId,
    selectedKeys,
    startTs,
    endTs,
    agg,
    interval,
  );

  const processed = processTimeseriesData(data, selectedKeys);

  const device: DashboardDevice = {
    ...summary,
    active: attributesNormalized.active ?? null,
    lastActivityTime: readTimestamp(attributesNormalized.lastActivityTime),
  };

  const businessSummary = calculateBusinessSummary(
    processed.events,
    attributesNormalized,
    processed.totalsByKey,
    processed.totalsByCategory,
    processed.seriesByKey,
    processed.lastRssi,
  );

  return {
    device,
    attributesNormalized,
    range: {
      startTs,
      endTs,
      agg: agg ?? null,
      interval: interval ?? null,
    },
    businessSummary,
    activitySeries: buildActivitySeries(
      processed.seriesByCategory,
      processed.seriesByKey,
    ),
    topZonesOrProducts: buildTopZonesOrProducts(
      selectedKeys,
      processed.totalsByKey,
      processed.seriesByKey,
    ),
    categoriesSummary: buildCategoriesSummary(
      selectedKeys,
      processed.totalsByKey,
      processed.totalsByCategory,
      processed.seriesByKey,
      processed.events,
    ),
    dictionary: buildDictionary(
      selectedKeys,
      processed.totalsByKey,
      processed.seriesByKey,
      processed.events,
    ),
    pendingDictionaryKeys,
    debug: {
      meta: {
        startTs,
        endTs,
        agg: agg ?? null,
        interval: interval ?? null,
        pointCount: processed.events.length,
      },
      selectedKeys,
      raw: data,
      attributesNormalized,
      totalsByKey: processed.totalsByKey,
      totalsByCategory: processed.totalsByCategory,
      events: processed.events,
      seriesByKey: processed.seriesByKey,
      seriesByCategory: processed.seriesByCategory,
      ...(errors.length > 0 ? { warnings: errors } : {}),
    },
  };
}

export const DEFAULT_DEVICE_NAME = "PerfumesIoT";

export function findDefaultDeviceId(
  devices: DashboardDevice[],
): string | null {
  const perfumes = devices.find(
    (d) => d.name.toLowerCase() === DEFAULT_DEVICE_NAME.toLowerCase(),
  );
  if (perfumes) return perfumes.id;

  const active = devices.find((d) => isActiveValue(d.active));
  return active?.id ?? devices[0]?.id ?? null;
}

export const MS_24H = 24 * 60 * 60 * 1000;
export const MS_7D = 7 * MS_24H;
export const MS_30D = 30 * MS_24H;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;
