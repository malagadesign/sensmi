/** Respuesta del endpoint POST /api/auth/login */
export interface SensmiLoginResponse {
  token: string;
  refreshToken: string;
}

/** Parámetros de paginación y búsqueda comunes en listados */
export interface SensmiListParams {
  pageSize?: number;
  page?: number;
  textSearch?: string;
  sortProperty?: string;
  sortOrder?: "ASC" | "DESC";
}

export interface SensmiDeviceListParams extends SensmiListParams {
  type?: string;
}

/** Tipos de entidad soportados por telemetría */
export type SensmiEntityType = "DEVICE" | "CUSTOMER" | "ASSET";

/** Parámetros para consultas de timeseries (preparado para dashboard) */
export interface SensmiTimeseriesParams {
  keys: string;
  startTs?: number;
  endTs?: number;
  intervalType?: string;
  interval?: number;
  timeZone?: string;
  limit?: number;
  agg?: string;
  orderBy?: string;
  useStrictDataTypes?: boolean;
}

/** Filtros previstos para el dashboard futuro */
export interface SensmiDashboardFilters {
  customerId?: string;
  deviceId?: string;
  startTs?: number;
  endTs?: number;
  timeseriesKey?: string;
}

export interface SensmiErrorDetails {
  message: string;
  status?: number;
  url?: string;
  body?: unknown;
}
