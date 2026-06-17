import {
  buildListQuery,
  clearSensmiToken,
  extractPageData,
  getDeviceEntityId,
  sensmiFetch,
  sensmiLogin,
  SensmiError,
} from "./sensmi";

export interface SensmiTestResult {
  success: boolean;
  timestamp: string;
  baseUrl: string;
  login: {
    status: "ok" | "error";
    message?: string;
    tokenPreview?: string;
  };
  customers: {
    count: number;
    first: unknown | null;
    error?: string;
  };
  devices: {
    count: number;
    first: unknown | null;
    error?: string;
  };
  telemetry: {
    deviceId: string | null;
    attributeKeys: unknown | null;
    timeseriesKeys: unknown | null;
    errors: string[];
  };
  errors: string[];
  raw: {
    customers: unknown | null;
    devices: unknown | null;
    attributeKeys: unknown | null;
    timeseriesKeys: unknown | null;
  };
}

function maskToken(token: string): string {
  if (token.length <= 12) return "***";
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

export async function runSensmiIntegrationTest(): Promise<SensmiTestResult> {
  const baseUrl = process.env.SENSMI_BASE_URL?.trim() ?? "";
  const errors: string[] = [];

  const result: SensmiTestResult = {
    success: false,
    timestamp: new Date().toISOString(),
    baseUrl,
    login: { status: "error" },
    customers: { count: 0, first: null },
    devices: { count: 0, first: null },
    telemetry: {
      deviceId: null,
      attributeKeys: null,
      timeseriesKeys: null,
      errors: [],
    },
    errors,
    raw: {
      customers: null,
      devices: null,
      attributeKeys: null,
      timeseriesKeys: null,
    },
  };

  clearSensmiToken();

  try {
    const loginData = await sensmiLogin();
    result.login = {
      status: "ok",
      message: "Autenticación exitosa",
      tokenPreview: maskToken(loginData.token),
    };
  } catch (error) {
    const message =
      error instanceof SensmiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Error desconocido en login";

    result.login = { status: "error", message };
    errors.push(`Login: ${message}`);
    return result;
  }

  const customersQuery = buildListQuery({ pageSize: 10, page: 0 });

  try {
    const customersRaw = await sensmiFetch(
      `/api/user/customers${customersQuery}`,
    );
    result.raw.customers = customersRaw;

    const { items, total } = extractPageData(customersRaw);
    result.customers = {
      count: total,
      first: items[0] ?? null,
    };
  } catch (error) {
    const message =
      error instanceof SensmiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Error desconocido al listar customers";

    result.customers.error = message;
    errors.push(`Customers: ${message}`);
  }

  const devicesQuery = buildListQuery({ pageSize: 10, page: 0 });

  try {
    const devicesRaw = await sensmiFetch(`/api/user/devices${devicesQuery}`);
    result.raw.devices = devicesRaw;

    const { items, total } = extractPageData(devicesRaw);
    result.devices = {
      count: total,
      first: items[0] ?? null,
    };

    const firstDevice = items[0];
    const deviceId = firstDevice ? getDeviceEntityId(firstDevice) : null;
    result.telemetry.deviceId = deviceId;

    if (deviceId) {
      try {
        const attributeKeys = await sensmiFetch(
          `/api/plugins/telemetry/DEVICE/${deviceId}/keys/attributes`,
        );
        result.telemetry.attributeKeys = attributeKeys;
        result.raw.attributeKeys = attributeKeys;
      } catch (error) {
        const message =
          error instanceof SensmiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Error desconocido al obtener attribute keys";

        result.telemetry.errors.push(`Attribute keys: ${message}`);
        errors.push(`Attribute keys: ${message}`);
      }

      try {
        const timeseriesKeys = await sensmiFetch(
          `/api/plugins/telemetry/DEVICE/${deviceId}/keys/timeseries`,
        );
        result.telemetry.timeseriesKeys = timeseriesKeys;
        result.raw.timeseriesKeys = timeseriesKeys;
      } catch (error) {
        const message =
          error instanceof SensmiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Error desconocido al obtener timeseries keys";

        result.telemetry.errors.push(`Timeseries keys: ${message}`);
        errors.push(`Timeseries keys: ${message}`);
      }
    }
  } catch (error) {
    const message =
      error instanceof SensmiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Error desconocido al listar devices";

    result.devices.error = message;
    errors.push(`Devices: ${message}`);
  }

  result.success =
    result.login.status === "ok" &&
    !result.customers.error &&
    !result.devices.error &&
    errors.length === 0;

  return result;
}
