import type { SensmiLoginResponse } from "./sensmi-types";

export class SensmiError extends Error {
  status?: number;
  url?: string;
  body?: unknown;

  constructor(message: string, details?: { status?: number; url?: string; body?: unknown }) {
    super(message);
    this.name = "SensmiError";
    this.status = details?.status;
    this.url = details?.url;
    this.body = details?.body;
  }
}

let cachedToken: string | null = null;
let cachedRefreshToken: string | null = null;

function getBaseUrl(): string {
  const baseUrl = process.env.SENSMI_BASE_URL?.trim();
  if (!baseUrl) {
    throw new SensmiError("SENSMI_BASE_URL no está configurada");
  }
  return baseUrl.replace(/\/$/, "");
}

function getCredentials(): { username: string; password: string } {
  const username = process.env.SENSMI_USERNAME?.trim();
  const password = process.env.SENSMI_PASSWORD;

  if (!username || !password) {
    throw new SensmiError(
      "SENSMI_USERNAME y SENSMI_PASSWORD deben estar configuradas en .env.local",
    );
  }

  return { username, password };
}

function maskToken(token: string): string {
  if (token.length <= 12) return "***";
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function logRequest(url: string, status: number, errorMessage?: string): void {
  const suffix = errorMessage ? ` — ${errorMessage}` : "";
  console.log(`[Sensmi] ${url} → HTTP ${status}${suffix}`);
}

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getBaseUrl()}${normalizedPath}`;
}

async function parseErrorBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      return await response.json();
    }
    return await response.text();
  } catch {
    return null;
  }
}

export function clearSensmiToken(): void {
  cachedToken = null;
  cachedRefreshToken = null;
}

export function getCachedToken(): string | null {
  return cachedToken;
}

export async function sensmiLogin(): Promise<SensmiLoginResponse> {
  const url = buildUrl("/api/auth/login");
  const { username, password } = getCredentials();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await parseErrorBody(response);
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? String((body as { message: unknown }).message)
        : `Login falló con HTTP ${response.status}`;

    logRequest(url, response.status, message);
    throw new SensmiError(message, { status: response.status, url, body });
  }

  const data = (await response.json()) as SensmiLoginResponse;

  if (!data.token) {
    logRequest(url, response.status, "Respuesta sin token");
    throw new SensmiError("La respuesta de login no incluye token", {
      status: response.status,
      url,
      body: data,
    });
  }

  cachedToken = data.token;
  cachedRefreshToken = data.refreshToken ?? null;

  logRequest(url, response.status);
  console.log(`[Sensmi] Login OK — token ${maskToken(data.token)}`);

  return data;
}

async function ensureToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const login = await sensmiLogin();
  return login.token;
}

export async function sensmiFetch<T = unknown>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {},
): Promise<T> {
  const { skipAuth = false, headers: customHeaders, ...fetchOptions } = options;
  const url = buildUrl(path);

  const headers = new Headers(customHeaders);
  headers.set("Accept", "application/json");

  if (!skipAuth) {
    const token = await ensureToken();
    headers.set("X-Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await parseErrorBody(response);
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? String((body as { message: unknown }).message)
        : `Request falló con HTTP ${response.status}`;

    logRequest(url, response.status, message);
    throw new SensmiError(message, { status: response.status, url, body });
  }

  logRequest(url, response.status);

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return (await response.text()) as T;
  }

  return (await response.json()) as T;
}

/** Extrae items y total de respuestas paginadas con distintos formatos */
export function extractPageData(response: unknown): {
  items: unknown[];
  total: number;
} {
  if (Array.isArray(response)) {
    return { items: response, total: response.length };
  }

  if (response && typeof response === "object") {
    const obj = response as Record<string, unknown>;
    const rawItems = obj.data ?? obj.content ?? obj.items ?? [];
    const items = Array.isArray(rawItems) ? rawItems : [];

    const total =
      typeof obj.totalElements === "number"
        ? obj.totalElements
        : typeof obj.total === "number"
          ? obj.total
          : items.length;

    return { items, total };
  }

  return { items: [], total: 0 };
}

/** Obtiene el ID de un device (formato ThingsBoard: id.id) */
export function getDeviceEntityId(device: unknown): string | null {
  if (!device || typeof device !== "object") return null;

  const record = device as Record<string, unknown>;

  if (record.id && typeof record.id === "object") {
    const idObj = record.id as Record<string, unknown>;
    if (typeof idObj.id === "string") return idObj.id;
  }

  if (typeof record.id === "string") return record.id;

  return null;
}

export function buildListQuery(
  params: Record<string, string | number | undefined>,
): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}

/** Deduplica keys de atributos/timeseries (la API puede devolver repetidas) */
export function dedupeKeys(keys: unknown): string[] {
  const collected: string[] = [];

  if (Array.isArray(keys)) {
    for (const key of keys) {
      if (typeof key === "string" && key) collected.push(key);
    }
  } else if (keys && typeof keys === "object") {
    for (const key of Object.keys(keys as Record<string, unknown>)) {
      if (key) collected.push(key);
    }
  }

  return [...new Set(collected)];
}

export interface SensmiDeviceSummary {
  id: string;
  name: string;
  type: string;
}

/** Extrae id, name y type de un device de la API */
export function getDeviceSummary(device: unknown): SensmiDeviceSummary | null {
  const id = getDeviceEntityId(device);
  if (!id) return null;

  const record = device as Record<string, unknown>;

  return {
    id,
    name: typeof record.name === "string" ? record.name : "—",
    type: typeof record.type === "string" ? record.type : "—",
  };
}

/** Cuenta puntos de datos en respuestas de timeseries { key: [{ts, value}] } */
export function countTelemetryPoints(data: unknown): number {
  if (!data || typeof data !== "object") return 0;

  let count = 0;
  for (const values of Object.values(data as Record<string, unknown>)) {
    if (Array.isArray(values)) count += values.length;
  }
  return count;
}

export type NormalizedAttributes = Record<
  string,
  string | number | boolean | null
>;

export type AnchorSource =
  | "lastActivityTime"
  | "lastDisconnectTime"
  | "lastConnectTime"
  | null;

interface AttributeArrayEntry {
  key?: string;
  value?: unknown;
  lastUpdateTs?: number;
}

function coerceAttributeValue(
  value: unknown,
): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
    if (/^\d+$/.test(value)) return Number(value);
    return value;
  }

  return String(value);
}

/**
 * Normaliza attributesValues (array con keys repetidas) a un objeto plano.
 * Si una key aparece varias veces, conserva el valor con lastUpdateTs más reciente.
 */
export function normalizeAttributes(
  attributesValues: unknown,
): NormalizedAttributes {
  const result: NormalizedAttributes = {};
  const bestUpdateTs: Record<string, number> = {};

  const applyEntry = (entry: AttributeArrayEntry): void => {
    const key = entry.key;
    if (!key) return;

    const lastUpdateTs =
      typeof entry.lastUpdateTs === "number" ? entry.lastUpdateTs : 0;
    const currentBest = bestUpdateTs[key] ?? -1;

    if (!(key in result) || lastUpdateTs >= currentBest) {
      bestUpdateTs[key] = lastUpdateTs;
      result[key] = coerceAttributeValue(entry.value);
    }
  };

  if (Array.isArray(attributesValues)) {
    for (const item of attributesValues) {
      if (item && typeof item === "object") {
        applyEntry(item as AttributeArrayEntry);
      }
    }
    return result;
  }

  if (attributesValues && typeof attributesValues === "object") {
    const record = attributesValues as Record<string, unknown>;

    for (const [key, value] of Object.entries(record)) {
      if (
        value &&
        typeof value === "object" &&
        "key" in value &&
        "value" in value
      ) {
        applyEntry(value as AttributeArrayEntry);
      } else {
        result[key] = coerceAttributeValue(unwrapAttributeValue(value));
      }
    }
  }

  return result;
}

/** Resuelve timestamp de anclaje con fallback en orden de prioridad */
export function resolveAnchorTimestamp(
  normalized: NormalizedAttributes,
  device?: unknown,
): { anchorTs: number | null; anchorSource: AnchorSource } {
  const candidates: Array<{
    anchorSource: NonNullable<AnchorSource>;
    field: string;
  }> = [
    { anchorSource: "lastActivityTime", field: "lastActivityTime" },
    { anchorSource: "lastDisconnectTime", field: "lastDisconnectTime" },
    { anchorSource: "lastConnectTime", field: "lastConnectTime" },
  ];

  for (const { anchorSource, field } of candidates) {
    const ts = parseTimestamp(normalized[field]);
    if (ts) return { anchorTs: ts, anchorSource };
  }

  if (device && typeof device === "object") {
    const record = device as Record<string, unknown>;
    for (const { anchorSource, field } of candidates) {
      const ts = parseTimestamp(record[field]);
      if (ts) return { anchorTs: ts, anchorSource };
    }
  }

  return { anchorTs: null, anchorSource: null };
}

/** Extrae un valor de atributo (soporta scopes anidados y array normalizado) */
export function extractAttributeValue(
  attributes: unknown,
  key: string,
): unknown {
  if (!attributes || typeof attributes !== "object") return null;

  if (Array.isArray(attributes)) {
    const normalized = normalizeAttributes(attributes);
    return key in normalized ? normalized[key] : null;
  }

  const record = attributes as Record<string, unknown>;
  if (key in record) return record[key];

  for (const scope of Object.values(record)) {
    if (scope && typeof scope === "object" && key in (scope as object)) {
      return (scope as Record<string, unknown>)[key];
    }
  }

  return null;
}

/** Desenvuelve valor de atributo ThingsBoard ({ value } o array histórico) */
export function unwrapAttributeValue(value: unknown): unknown {
  if (Array.isArray(value) && value.length > 0) {
    const last = value[value.length - 1];
    if (last && typeof last === "object" && "value" in last) {
      return (last as { value: unknown }).value;
    }
  }
  if (value && typeof value === "object" && "value" in value) {
    return (value as { value: unknown }).value;
  }
  return value;
}

/** Parsea timestamp Unix en ms desde distintos formatos de la API */
export function parseTimestamp(value: unknown): number | null {
  const unwrapped = unwrapAttributeValue(value);

  if (typeof unwrapped === "number" && Number.isFinite(unwrapped)) {
    return unwrapped;
  }

  if (typeof unwrapped === "string" && /^\d+$/.test(unwrapped)) {
    return Number(unwrapped);
  }

  return null;
}

/** Cuenta puntos por key en respuesta de timeseries */
export function getPerKeyPointCounts(data: unknown): Record<string, number> {
  if (!data || typeof data !== "object") return {};

  const counts: Record<string, number> = {};
  for (const [key, values] of Object.entries(data as Record<string, unknown>)) {
    counts[key] = Array.isArray(values) ? values.length : 0;
  }
  return counts;
}

/** Preview acotado de timeseries para inspección rápida */
export function previewTelemetryData(
  data: unknown,
  maxPerKey = 5,
): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;

  const preview: Record<string, unknown> = {};

  for (const [key, values] of Object.entries(data as Record<string, unknown>)) {
    if (!Array.isArray(values)) {
      preview[key] = values;
      continue;
    }

    if (values.length <= maxPerKey * 2) {
      preview[key] = values;
    } else {
      preview[key] = {
        total: values.length,
        first: values.slice(0, maxPerKey),
        last: values.slice(-maxPerKey),
      };
    }
  }

  return preview;
}
