import {
  type AnchorSource,
  buildListQuery,
  clearSensmiToken,
  countTelemetryPoints,
  dedupeKeys,
  extractPageData,
  getDeviceSummary,
  getPerKeyPointCounts,
  normalizeAttributes,
  type NormalizedAttributes,
  previewTelemetryData,
  resolveAnchorTimestamp,
  sensmiFetch,
  sensmiLogin,
  SensmiError,
} from "./sensmi";

const ATTRIBUTE_KEYS_TO_FETCH = [
  "DeviceName",
  "SerialNumber",
  "Model",
  "DeviceHealth",
  "DeviceHealthState",
  "NeoState",
  "Customer",
  "active",
  "lastActivityTime",
  "lastConnectTime",
  "lastDisconnectTime",
  "EngagementSent",
] as const;

const TIMESERIES_KEYS = ["Engagement", "EngagementSent"] as const;

const HIGHLIGHT_KEY_PATTERNS = ["Engagement", "Dwell", "DPU", "DPB"] as const;
const MS_24H = 24 * 60 * 60 * 1000;
const MS_7D = 7 * MS_24H;
const MS_30D = 30 * MS_24H;
const MS_1D = MS_24H;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const KEYS_BATCH_SIZE = 15;

export interface TelemetryQueryResult {
  startTs: number;
  endTs: number;
  basic: {
    data: unknown | null;
    preview: Record<string, unknown> | null;
    pointCount: number;
    error?: string;
  };
  aggregated: {
    data: unknown | null;
    preview: Record<string, unknown> | null;
    pointCount: number;
    error?: string;
  };
}

export interface KeyTelemetrySummary {
  key: string;
  pointCount: number;
  highlighted: boolean;
  preview: unknown;
}

export interface ActivityBasedTelemetry {
  anchorTelemetryTs: number | null;
  anchorSource: AnchorSource;
  lastActivityTime: number | null;
  lastConnectTime: number | null;
  lastDisconnectTime: number | null;
  startTs: number;
  endTs: number;
  queriedKeys: string[];
  keysWithData: KeyTelemetrySummary[];
  keysWithoutData: string[];
  highlightedKeysWithData: string[];
  hasHistoricalData: boolean;
  totalPoints: number;
  aggregatedPointCount: number;
  preview: Record<string, unknown> | null;
  aggregatedPreview: Record<string, unknown> | null;
  data: unknown | null;
  aggregatedData: unknown | null;
  error?: string;
  noDataError?: string;
}

export interface DeviceTelemetryResult {
  id: string;
  name: string;
  type: string;
  attributeKeys: string[];
  timeseriesKeys: string[];
  attributesValuesRaw: unknown | null;
  attributesNormalized: NormalizedAttributes;
  anchorTelemetryTs: number | null;
  anchorSource: AnchorSource;
  activityTelemetry: ActivityBasedTelemetry;
  telemetry24h: TelemetryQueryResult;
  telemetry7d: TelemetryQueryResult;
  telemetry30d: TelemetryQueryResult;
  errors: string[];
}

export interface SensmiTelemetryTestResult {
  success: boolean;
  timestamp: string;
  baseUrl: string;
  connection: {
    status: "ok" | "error";
    message?: string;
    tokenPreview?: string;
  };
  deviceCount: number;
  devices: DeviceTelemetryResult[];
  errors: string[];
}

function maskToken(token: string): string {
  if (token.length <= 12) return "***";
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof SensmiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error desconocido";
}

function getTimeRange(durationMs: number): { startTs: number; endTs: number } {
  const endTs = Date.now();
  return { startTs: endTs - durationMs, endTs };
}

function createEmptyTelemetryQuery(
  startTs: number,
  endTs: number,
): TelemetryQueryResult {
  return {
    startTs,
    endTs,
    basic: { data: null, preview: null, pointCount: 0 },
    aggregated: { data: null, preview: null, pointCount: 0 },
  };
}

function createEmptyActivityTelemetry(): ActivityBasedTelemetry {
  return {
    anchorTelemetryTs: null,
    anchorSource: null,
    lastActivityTime: null,
    lastConnectTime: null,
    lastDisconnectTime: null,
    startTs: 0,
    endTs: 0,
    queriedKeys: [],
    keysWithData: [],
    keysWithoutData: [],
    highlightedKeysWithData: [],
    hasHistoricalData: false,
    totalPoints: 0,
    aggregatedPointCount: 0,
    preview: null,
    aggregatedPreview: null,
    data: null,
    aggregatedData: null,
  };
}

function isHighlightedKey(key: string): boolean {
  return HIGHLIGHT_KEY_PATTERNS.some((pattern) => key.includes(pattern));
}

function sortTimeseriesKeysByPriority(keys: string[]): string[] {
  const priority = (key: string): number => {
    if (key === "Engagement") return 0;
    if (key === "EngagementSent") return 1;
    if (key.includes("Dwell")) return 2;
    if (key.includes("DPU")) return 3;
    if (key.includes("DPB")) return 4;
    if (isHighlightedKey(key)) return 5;
    return 10;
  };

  return [...keys].sort(
    (a, b) => priority(a) - priority(b) || a.localeCompare(b),
  );
}

function readTimestamp(
  normalized: NormalizedAttributes,
  field: string,
): number | null {
  const value = normalized[field];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function buildKeySummaries(
  data: unknown,
  queriedKeys: string[],
): {
  keysWithData: KeyTelemetrySummary[];
  keysWithoutData: string[];
  highlightedKeysWithData: string[];
} {
  const counts = getPerKeyPointCounts(data);
  const keysWithData: KeyTelemetrySummary[] = [];
  const keysWithoutData: string[] = [];

  for (const key of queriedKeys) {
    const pointCount = counts[key] ?? 0;
    if (pointCount > 0) {
      const keyData =
        data && typeof data === "object"
          ? (data as Record<string, unknown>)[key]
          : null;

      keysWithData.push({
        key,
        pointCount,
        highlighted: isHighlightedKey(key),
        preview: previewTelemetryData({ [key]: keyData }, 3)?.[key] ?? keyData,
      });
    } else {
      keysWithoutData.push(key);
    }
  }

  keysWithData.sort((a, b) => b.pointCount - a.pointCount);

  return {
    keysWithData,
    keysWithoutData,
    highlightedKeysWithData: keysWithData
      .filter((item) => item.highlighted)
      .map((item) => item.key),
  };
}

async function fetchTelemetryWithKeys(
  deviceId: string,
  keys: string[],
  startTs: number,
  endTs: number,
  options?: { aggregated?: boolean; interval?: number },
): Promise<{ data: unknown | null; error?: string }> {
  if (keys.length === 0) {
    return { data: null, error: "No hay keys para consultar" };
  }

  const query = buildListQuery({
    keys: keys.join(","),
    startTs,
    endTs,
    limit: 1000,
    orderBy: "ASC",
    ...(options?.aggregated
      ? { interval: options.interval ?? DAY_MS, agg: "SUM" }
      : {}),
  });

  try {
    const data = await sensmiFetch(
      `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries${query}`,
    );
    return { data };
  } catch (error) {
    return { data: null, error: getErrorMessage(error) };
  }
}

async function fetchAllKeysTelemetry(
  deviceId: string,
  keys: string[],
  startTs: number,
  endTs: number,
  options?: { aggregated?: boolean; interval?: number },
): Promise<{ data: Record<string, unknown>; errors: string[] }> {
  const merged: Record<string, unknown> = {};
  const errors: string[] = [];

  for (let i = 0; i < keys.length; i += KEYS_BATCH_SIZE) {
    const batch = keys.slice(i, i + KEYS_BATCH_SIZE);
    const result = await fetchTelemetryWithKeys(
      deviceId,
      batch,
      startTs,
      endTs,
      options,
    );

    if (result.error) {
      errors.push(result.error);
      continue;
    }

    if (result.data && typeof result.data === "object") {
      Object.assign(merged, result.data as Record<string, unknown>);
    }
  }

  return { data: merged, errors };
}

async function fetchActivityBasedTelemetry(
  deviceId: string,
  timeseriesKeys: string[],
  anchorTs: number,
  anchorSource: AnchorSource,
  normalized: NormalizedAttributes,
): Promise<ActivityBasedTelemetry> {
  const startTs = anchorTs - MS_7D;
  const endTs = anchorTs + MS_1D;
  const queriedKeys = sortTimeseriesKeysByPriority(timeseriesKeys);

  const result: ActivityBasedTelemetry = {
    anchorTelemetryTs: anchorTs,
    anchorSource,
    lastActivityTime: readTimestamp(normalized, "lastActivityTime"),
    lastConnectTime: readTimestamp(normalized, "lastConnectTime"),
    lastDisconnectTime: readTimestamp(normalized, "lastDisconnectTime"),
    startTs,
    endTs,
    queriedKeys,
    keysWithData: [],
    keysWithoutData: [],
    highlightedKeysWithData: [],
    hasHistoricalData: false,
    totalPoints: 0,
    aggregatedPointCount: 0,
    preview: null,
    aggregatedPreview: null,
    data: null,
    aggregatedData: null,
  };

  if (timeseriesKeys.length === 0) {
    result.error = "No hay timeseries keys disponibles";
    return result;
  }

  const { data, errors } = await fetchAllKeysTelemetry(
    deviceId,
    queriedKeys,
    startTs,
    endTs,
  );

  if (errors.length > 0 && Object.keys(data).length === 0) {
    result.error = errors.join("; ");
    return result;
  }

  if (errors.length > 0) {
    result.error = errors.join("; ");
  }

  result.data = data;
  result.totalPoints = countTelemetryPoints(data);
  result.preview = previewTelemetryData(data);

  const summaries = buildKeySummaries(data, queriedKeys);
  result.keysWithData = summaries.keysWithData;
  result.keysWithoutData = summaries.keysWithoutData;
  result.highlightedKeysWithData = summaries.highlightedKeysWithData;
  result.hasHistoricalData = result.keysWithData.length > 0;

  if (!result.hasHistoricalData) {
    result.noDataError = `Sin datos históricos en el rango ${startTs} → ${endTs}`;
  }

  const { data: aggData, errors: aggErrors } = await fetchAllKeysTelemetry(
    deviceId,
    queriedKeys,
    startTs,
    endTs,
    { aggregated: true, interval: HOUR_MS },
  );

  if (aggErrors.length > 0 && Object.keys(aggData).length === 0) {
    result.error = [result.error, ...aggErrors].filter(Boolean).join("; ");
  } else if (aggErrors.length > 0) {
    result.error = [result.error, ...aggErrors].filter(Boolean).join("; ");
  }

  result.aggregatedData = aggData;
  result.aggregatedPointCount = countTelemetryPoints(aggData);
  result.aggregatedPreview = previewTelemetryData(aggData);

  return result;
}

async function fetchTelemetryBasic(
  deviceId: string,
  startTs: number,
  endTs: number,
): Promise<{ data: unknown | null; error?: string }> {
  return fetchTelemetryWithKeys(
    deviceId,
    [...TIMESERIES_KEYS],
    startTs,
    endTs,
  );
}

async function fetchTelemetryAggregated(
  deviceId: string,
  startTs: number,
  endTs: number,
): Promise<{ data: unknown | null; error?: string }> {
  return fetchTelemetryWithKeys(
    deviceId,
    [...TIMESERIES_KEYS],
    startTs,
    endTs,
    { aggregated: true },
  );
}

async function fetchTelemetryForRange(
  deviceId: string,
  durationMs: number,
): Promise<TelemetryQueryResult> {
  const { startTs, endTs } = getTimeRange(durationMs);
  const result = createEmptyTelemetryQuery(startTs, endTs);

  const basic = await fetchTelemetryBasic(deviceId, startTs, endTs);
  if (basic.error) {
    result.basic.error = basic.error;
  } else {
    result.basic.data = basic.data;
    result.basic.pointCount = countTelemetryPoints(basic.data);
    result.basic.preview = previewTelemetryData(basic.data);
  }

  if (!basic.error) {
    const aggregated = await fetchTelemetryAggregated(deviceId, startTs, endTs);
    if (aggregated.error) {
      result.aggregated.error = aggregated.error;
    } else {
      result.aggregated.data = aggregated.data;
      result.aggregated.pointCount = countTelemetryPoints(aggregated.data);
      result.aggregated.preview = previewTelemetryData(aggregated.data);
    }
  }

  return result;
}

async function processDevice(device: unknown): Promise<DeviceTelemetryResult> {
  const summary = getDeviceSummary(device);
  const errors: string[] = [];

  if (!summary) {
    return {
      id: "unknown",
      name: "—",
      type: "—",
      attributeKeys: [],
      timeseriesKeys: [],
      attributesValuesRaw: null,
      attributesNormalized: {},
      anchorTelemetryTs: null,
      anchorSource: null,
      activityTelemetry: createEmptyActivityTelemetry(),
      telemetry24h: createEmptyTelemetryQuery(0, 0),
      telemetry7d: createEmptyTelemetryQuery(0, 0),
      telemetry30d: createEmptyTelemetryQuery(0, 0),
      errors: ["No se pudo extraer id del device"],
    };
  }

  const deviceResult: DeviceTelemetryResult = {
    ...summary,
    attributeKeys: [],
    timeseriesKeys: [],
    attributesValuesRaw: null,
    attributesNormalized: {},
    anchorTelemetryTs: null,
    anchorSource: null,
    activityTelemetry: createEmptyActivityTelemetry(),
    telemetry24h: createEmptyTelemetryQuery(0, 0),
    telemetry7d: createEmptyTelemetryQuery(0, 0),
    telemetry30d: createEmptyTelemetryQuery(0, 0),
    errors,
  };

  let attributeKeysRaw: unknown = null;
  try {
    attributeKeysRaw = await sensmiFetch(
      `/api/plugins/telemetry/DEVICE/${summary.id}/keys/attributes`,
    );
    deviceResult.attributeKeys = dedupeKeys(attributeKeysRaw);
  } catch (error) {
    const message = getErrorMessage(error);
    errors.push(`Attribute keys: ${message}`);
  }

  try {
    const timeseriesKeysRaw = await sensmiFetch(
      `/api/plugins/telemetry/DEVICE/${summary.id}/keys/timeseries`,
    );
    deviceResult.timeseriesKeys = dedupeKeys(timeseriesKeysRaw);
  } catch (error) {
    const message = getErrorMessage(error);
    errors.push(`Timeseries keys: ${message}`);
  }

  const availableAttributeKeys = ATTRIBUTE_KEYS_TO_FETCH.filter((key) =>
    deviceResult.attributeKeys.includes(key),
  );

  if (availableAttributeKeys.length > 0) {
    try {
      const query = buildListQuery({ keys: availableAttributeKeys.join(",") });
      deviceResult.attributesValuesRaw = await sensmiFetch(
        `/api/plugins/telemetry/DEVICE/${summary.id}/values/attributes${query}`,
      );
      deviceResult.attributesNormalized = normalizeAttributes(
        deviceResult.attributesValuesRaw,
      );
    } catch (error) {
      const message = getErrorMessage(error);
      errors.push(`Attribute values: ${message}`);
    }
  } else if (deviceResult.attributeKeys.length > 0) {
    errors.push(
      "Ninguna de las attribute keys objetivo está disponible en este device",
    );
  }

  const { anchorTs, anchorSource } = resolveAnchorTimestamp(
    deviceResult.attributesNormalized,
    device,
  );

  deviceResult.anchorTelemetryTs = anchorTs;
  deviceResult.anchorSource = anchorSource;

  if (!anchorTs) {
    const anchorError =
      "No hay timestamp de anclaje (lastActivityTime, lastDisconnectTime ni lastConnectTime)";
    errors.push(anchorError);
    deviceResult.activityTelemetry.error = anchorError;
  } else if (deviceResult.timeseriesKeys.length === 0) {
    errors.push("Sin timeseries keys para consulta basada en anchor");
    deviceResult.activityTelemetry.error = "Sin timeseries keys disponibles";
  } else {
    try {
      deviceResult.activityTelemetry = await fetchActivityBasedTelemetry(
        summary.id,
        deviceResult.timeseriesKeys,
        anchorTs,
        anchorSource,
        deviceResult.attributesNormalized,
      );

      if (deviceResult.activityTelemetry.error) {
        errors.push(
          `Activity telemetry: ${deviceResult.activityTelemetry.error}`,
        );
      }

      if (deviceResult.activityTelemetry.highlightedKeysWithData.length > 0) {
        console.log(
          `[Sensmi] ${summary.name}: datos en keys destacadas → ${deviceResult.activityTelemetry.highlightedKeysWithData.join(", ")}`,
        );
      }
    } catch (error) {
      const message = getErrorMessage(error);
      errors.push(`Activity telemetry: ${message}`);
      deviceResult.activityTelemetry.error = message;
    }
  }

  const availableTimeseriesKeys = TIMESERIES_KEYS.filter((key) =>
    deviceResult.timeseriesKeys.includes(key),
  );

  if (availableTimeseriesKeys.length === 0) {
    errors.push(
      "Engagement y/o EngagementSent no están disponibles en timeseries keys",
    );
  } else {
    try {
      deviceResult.telemetry24h = await fetchTelemetryForRange(
        summary.id,
        MS_24H,
      );
      if (deviceResult.telemetry24h.basic.error) {
        errors.push(`Telemetry 24h: ${deviceResult.telemetry24h.basic.error}`);
      }
      if (deviceResult.telemetry24h.aggregated.error) {
        errors.push(
          `Telemetry 24h (agg): ${deviceResult.telemetry24h.aggregated.error}`,
        );
      }
    } catch (error) {
      errors.push(`Telemetry 24h: ${getErrorMessage(error)}`);
    }

    try {
      deviceResult.telemetry7d = await fetchTelemetryForRange(summary.id, MS_7D);
      if (deviceResult.telemetry7d.basic.error) {
        errors.push(`Telemetry 7d: ${deviceResult.telemetry7d.basic.error}`);
      }
      if (deviceResult.telemetry7d.aggregated.error) {
        errors.push(
          `Telemetry 7d (agg): ${deviceResult.telemetry7d.aggregated.error}`,
        );
      }
    } catch (error) {
      errors.push(`Telemetry 7d: ${getErrorMessage(error)}`);
    }

    try {
      deviceResult.telemetry30d = await fetchTelemetryForRange(
        summary.id,
        MS_30D,
      );
      if (deviceResult.telemetry30d.basic.error) {
        errors.push(`Telemetry 30d: ${deviceResult.telemetry30d.basic.error}`);
      }
      if (deviceResult.telemetry30d.aggregated.error) {
        errors.push(
          `Telemetry 30d (agg): ${deviceResult.telemetry30d.aggregated.error}`,
        );
      }
    } catch (error) {
      errors.push(`Telemetry 30d: ${getErrorMessage(error)}`);
    }
  }

  return deviceResult;
}

export async function runSensmiTelemetryTest(): Promise<SensmiTelemetryTestResult> {
  const baseUrl = process.env.SENSMI_BASE_URL?.trim() ?? "";
  const errors: string[] = [];

  const result: SensmiTelemetryTestResult = {
    success: false,
    timestamp: new Date().toISOString(),
    baseUrl,
    connection: { status: "error" },
    deviceCount: 0,
    devices: [],
    errors,
  };

  clearSensmiToken();

  try {
    const loginData = await sensmiLogin();
    result.connection = {
      status: "ok",
      message: "Autenticación exitosa",
      tokenPreview: maskToken(loginData.token),
    };
  } catch (error) {
    const message = getErrorMessage(error);
    result.connection = { status: "error", message };
    errors.push(`Login: ${message}`);
    return result;
  }

  let devices: unknown[] = [];

  try {
    const devicesQuery = buildListQuery({ pageSize: 50, page: 0 });
    const devicesRaw = await sensmiFetch(`/api/user/devices${devicesQuery}`);
    devices = extractPageData(devicesRaw).items;
    result.deviceCount = devices.length;
  } catch (error) {
    const message = getErrorMessage(error);
    errors.push(`Devices: ${message}`);
    return result;
  }

  for (const device of devices) {
    try {
      const deviceResult = await processDevice(device);
      result.devices.push(deviceResult);
      if (deviceResult.errors.length > 0) {
        errors.push(
          ...deviceResult.errors.map(
            (err) => `${deviceResult.name} (${deviceResult.id}): ${err}`,
          ),
        );
      }
    } catch (error) {
      const message = getErrorMessage(error);
      errors.push(`Device processing: ${message}`);
    }
  }

  result.success =
    result.connection.status === "ok" &&
    result.devices.length > 0 &&
    result.devices.some(
      (d) =>
        d.activityTelemetry.hasHistoricalData ||
        d.telemetry24h.basic.pointCount > 0 ||
        d.telemetry7d.basic.pointCount > 0 ||
        d.telemetry30d.basic.pointCount > 0 ||
        d.attributesValuesRaw !== null,
    );

  return result;
}
