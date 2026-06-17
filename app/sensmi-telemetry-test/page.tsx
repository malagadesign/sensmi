"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  ActivityBasedTelemetry,
  DeviceTelemetryResult,
  SensmiTelemetryTestResult,
  TelemetryQueryResult,
} from "@/lib/sensmi-telemetry-test";

type FetchState = "idle" | "loading" | "done" | "error";

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
        ok
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
      }`}
    >
      {label}
    </span>
  );
}

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-4 text-xs leading-relaxed text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function CollapsibleRaw({ title, data }: { title: string; data: unknown }) {
  const [open, setOpen] = useState(false);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="rounded-lg border border-zinc-200 dark:border-zinc-800"
    >
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900">
        {title}
      </summary>
      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <JsonBlock data={data} />
      </div>
    </details>
  );
}

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatTs(value: unknown): string {
  if (typeof value === "number") {
    return new Date(value).toLocaleString("es-AR");
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return new Date(Number(value)).toLocaleString("es-AR");
  }
  return value != null ? String(value) : "—";
}

function DeviceStatus({ device }: { device: DeviceTelemetryResult }) {
  const attrs = device.attributesNormalized;
  const health = attrs.DeviceHealth;
  const healthState = attrs.DeviceHealthState;
  const neoState = attrs.NeoState;
  const active = attrs.active;

  const isActive =
    active === true || active === "true" || active === 1 || active === "1";

  return (
    <div className="flex flex-wrap gap-2">
      <StatusBadge
        ok={isActive}
        label={isActive ? "Activo" : "Inactivo"}
      />
      {health != null && (
        <StatusBadge ok={String(health) !== "CRITICAL"} label={`Health: ${String(health)}`} />
      )}
      {healthState != null && (
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          HealthState: {String(healthState)}
        </span>
      )}
      {neoState != null && (
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          NeoState: {String(neoState)}
        </span>
      )}
    </div>
  );
}

function AttributesTable({ device }: { device: DeviceTelemetryResult }) {
  const rows = [
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
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="py-2 pr-4 font-medium text-zinc-500">Atributo</th>
            <th className="py-2 font-medium text-zinc-500">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((key) => {
            const raw = device.attributesNormalized[key];
            const display =
              key.includes("Time") || key.includes("last")
                ? formatTs(raw)
                : raw != null
                  ? String(raw)
                  : "—";

            return (
              <tr
                key={key}
                className="border-b border-zinc-100 dark:border-zinc-900"
              >
                <td className="py-2 pr-4 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                  {key}
                </td>
                <td className="py-2 text-zinc-800 dark:text-zinc-200">
                  {display}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ActivityTelemetrySection({
  activity,
  deviceName,
}: {
  activity: ActivityBasedTelemetry;
  deviceName: string;
}) {
  const activeLabel =
    activity.anchorSource === null
      ? "Sin anchor"
      : `${activity.totalPoints} puntos · ${activity.keysWithData.length} keys con datos`;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
      <div>
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Telemetría histórica — {deviceName}
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          Ventana: 7 días antes → 1 día después del timestamp de anclaje
        </p>
      </div>

      {activity.error && !activity.anchorTelemetryTs ? (
        <p className="text-sm text-red-600 dark:text-red-400">{activity.error}</p>
      ) : (
        <>
          <div className="grid gap-2 text-sm text-zinc-700 dark:text-zinc-300 sm:grid-cols-2">
            <span>
              lastActivityTime:{" "}
              <code className="font-mono">
                {activity.lastActivityTime
                  ? formatTs(activity.lastActivityTime)
                  : "—"}
              </code>
            </span>
            <span>
              lastConnectTime:{" "}
              <code className="font-mono">
                {activity.lastConnectTime
                  ? formatTs(activity.lastConnectTime)
                  : "—"}
              </code>
            </span>
            <span>
              lastDisconnectTime:{" "}
              <code className="font-mono">
                {activity.lastDisconnectTime
                  ? formatTs(activity.lastDisconnectTime)
                  : "—"}
              </code>
            </span>
            <span>
              Anchor usado:{" "}
              <code className="font-mono">
                {activity.anchorSource ?? "—"}
                {activity.anchorTelemetryTs
                  ? ` (${formatTs(activity.anchorTelemetryTs)})`
                  : ""}
              </code>
            </span>
            <span>
              Rango consultado:{" "}
              <code className="font-mono">
                {formatTs(activity.startTs)} → {formatTs(activity.endTs)}
              </code>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge
              ok={activity.hasHistoricalData}
              label={
                activity.hasHistoricalData ? activeLabel : "Sin datos históricos"
              }
            />
            <span className="text-xs text-zinc-500">
              Keys consultadas: {activity.queriedKeys.length}
            </span>
          </div>

          {activity.highlightedKeysWithData.length > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                Keys destacadas con datos (Engagement / Dwell / DPU / DPB):
              </p>
              <p className="mt-1 font-mono text-sm text-emerald-700 dark:text-emerald-400">
                {activity.highlightedKeysWithData.join(", ")}
              </p>
            </div>
          )}

          {activity.keysWithData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="py-2 pr-4 font-medium text-zinc-500">Key</th>
                    <th className="py-2 pr-4 font-medium text-zinc-500">Puntos</th>
                    <th className="py-2 font-medium text-zinc-500">Destacada</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.keysWithData.map((item) => (
                    <tr
                      key={item.key}
                      className={`border-b border-zinc-100 dark:border-zinc-900 ${
                        item.highlighted
                          ? "bg-emerald-50/60 dark:bg-emerald-950/20"
                          : ""
                      }`}
                    >
                      <td className="py-2 pr-4 font-mono text-xs">{item.key}</td>
                      <td className="py-2 pr-4">{item.pointCount}</td>
                      <td className="py-2">
                        {item.highlighted ? "✓" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              Ninguna key devolvió puntos en el rango consultado.
            </p>
          )}

          {activity.keysWithData.length > 0 && (
            <>
              <CollapsibleRaw
                title="Preview raw por key"
                data={activity.keysWithData}
              />
              {activity.aggregatedPreview && (
                <CollapsibleRaw
                  title={`Preview agregado horario SUM (${activity.aggregatedPointCount} puntos)`}
                  data={activity.aggregatedPreview}
                />
              )}
            </>
          )}

          {activity.noDataError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {activity.noDataError}
            </p>
          )}

          {activity.error && activity.anchorTelemetryTs && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Advertencias: {activity.error}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function TelemetryRangePreview({
  label,
  telemetry,
}: {
  label: string;
  telemetry: TelemetryQueryResult;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h4 className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        {label}
      </h4>
      <p className="mb-3 text-xs text-zinc-500">
        {formatTs(telemetry.startTs)} → {formatTs(telemetry.endTs)}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Raw ({telemetry.basic.pointCount} puntos)
          </p>
          {telemetry.basic.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">
              {telemetry.basic.error}
            </p>
          ) : telemetry.basic.preview ? (
            <JsonBlock data={telemetry.basic.preview} />
          ) : (
            <p className="text-sm text-zinc-500">Sin datos</p>
          )}
        </div>
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Agregado diario SUM ({telemetry.aggregated.pointCount} puntos)
          </p>
          {telemetry.aggregated.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">
              {telemetry.aggregated.error}
            </p>
          ) : telemetry.aggregated.preview ? (
            <JsonBlock data={telemetry.aggregated.preview} />
          ) : (
            <p className="text-sm text-zinc-500">Sin datos</p>
          )}
        </div>
      </div>
    </div>
  );
}

function DeviceCard({ device }: { device: DeviceTelemetryResult }) {
  return (
    <article className="flex flex-col gap-5 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {device.name}
            </h2>
            <p className="mt-1 font-mono text-xs text-zinc-500">{device.id}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Tipo: {device.type}
            </p>
          </div>
          <DeviceStatus device={device} />
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          active:{" "}
          <strong>
            {device.attributesNormalized.active === true ||
            device.attributesNormalized.active === "true"
              ? "true"
              : String(device.attributesNormalized.active ?? "—")}
          </strong>
        </p>
      </header>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Atributos normalizados
        </h3>
        <AttributesTable device={device} />
        <div className="mt-3">
          <CollapsibleRaw
            title="attributesValuesRaw"
            data={device.attributesValuesRaw}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Timeseries keys ({device.timeseriesKeys.length})
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {device.timeseriesKeys.length > 0
            ? device.timeseriesKeys.join(", ")
            : "(sin keys)"}
        </p>
      </section>

      <ActivityTelemetrySection
        activity={device.activityTelemetry}
        deviceName={device.name}
      />

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Engagement / EngagementSent
        </h3>
        <TelemetryRangePreview label="Últimas 24 horas" telemetry={device.telemetry24h} />
        <TelemetryRangePreview label="Últimos 7 días" telemetry={device.telemetry7d} />
        <TelemetryRangePreview label="Últimos 30 días" telemetry={device.telemetry30d} />
      </section>

      {device.errors.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-red-600 dark:text-red-400">
            Errores del device
          </h3>
          <ul className="list-inside list-disc text-sm text-red-600 dark:text-red-400">
            {device.errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </section>
      )}

      <CollapsibleRaw title="Respuesta raw del device" data={device} />
    </article>
  );
}

export default function SensmiTelemetryTestPage() {
  const [state, setState] = useState<FetchState>("idle");
  const [result, setResult] = useState<SensmiTelemetryTestResult | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const runTest = useCallback(async () => {
    setState("loading");
    setFetchError(null);

    try {
      const response = await fetch("/api/sensmi/telemetry-test", {
        cache: "no-store",
      });
      const data = (await response.json()) as SensmiTelemetryTestResult & {
        error?: string;
      };

      if (!response.ok && data.error && !data.connection) {
        setFetchError(data.error);
        setResult(null);
        setState("error");
        return;
      }

      setResult(data);
      setState("done");
    } catch (error) {
      setFetchError(
        error instanceof Error
          ? error.message
          : "No se pudo contactar al servidor",
      );
      setResult(null);
      setState("error");
    }
  }, []);

  useEffect(() => {
    runTest();
  }, [runTest]);

  const handleDownload = () => {
    if (!result) return;
    const date = new Date(result.timestamp)
      .toISOString()
      .slice(0, 19)
      .replace(/:/g, "-");
    downloadJson(result, `sensmi-telemetry-test-${date}.json`);
  };

  const connected = result?.connection.status === "ok";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Sensmi — Prueba de telemetría
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Telemetría histórica anclada a lastActivityTime y exploración de todas
            las timeseries keys por device.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runTest}
            disabled={state === "loading"}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {state === "loading" ? "Ejecutando…" : "Re-ejecutar prueba"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!result || state === "loading"}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Descargar JSON
          </button>
        </div>
      </header>

      {state === "loading" && (
        <p className="text-sm text-zinc-500">
          Consultando atributos y telemetría de todos los devices…
        </p>
      )}

      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Error al ejecutar la prueba: {fetchError}
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge
                ok={connected}
                label={connected ? "Conectado" : "Sin conexión"}
              />
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Base URL: <code className="font-mono">{result.baseUrl}</code>
              </span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Devices: <strong>{result.deviceCount}</strong>
              </span>
              {result.connection.tokenPreview && (
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  Token:{" "}
                  <code className="font-mono">{result.connection.tokenPreview}</code>
                </span>
              )}
            </div>
            {result.connection.message && (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {result.connection.message}
              </p>
            )}
          </section>

          {result.errors.length > 0 && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
              <h2 className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                Errores globales ({result.errors.length})
              </h2>
              <ul className="list-inside list-disc text-sm text-amber-800 dark:text-amber-300">
                {result.errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex flex-col gap-6">
            {result.devices.map((device) => (
              <DeviceCard key={device.id} device={device} />
            ))}
          </div>

          <CollapsibleRaw title="Respuesta raw completa" data={result} />
        </div>
      )}
    </main>
  );
}
