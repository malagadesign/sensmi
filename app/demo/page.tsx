"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DemoAlert } from "@/lib/demo-insights";
import type { DemoRangePreset } from "@/lib/demo-sensmi";

interface DemoPayload {
  device: {
    id: string;
    name: string;
    type?: string | null;
    active?: unknown;
    lastActivityTime?: number | null;
    customer?: string | null;
  } | null;
  devices: Array<{
    id: string;
    name: string;
    type?: string | null;
    active?: unknown;
    lastActivityTime?: number | null;
    customer?: string | null;
  }>;
  location: {
    clientName: string;
    locationName: string;
    city: string;
    country: string;
    countryCode: string;
    businessType: string;
    screenType: string;
  };
  metrics: {
    totalInteractions: number;
    engagementTotal: number;
    telemetryPointCount: number;
    activitySeries: Array<{ ts: number; value: number }>;
    lastActivityTime: number | null;
    sensorStatus: "Activo" | "Inactivo" | "Desconocido";
    lastRssi: number | null;
  } | null;
  context: {
    weather: {
      available: boolean;
      temperature: number | null;
      rain: number | null;
      windSpeed: number | null;
      summary: string;
    };
    dollar: {
      available: boolean;
      rates: Array<{
        name: string;
        buy: number | null;
        sell: number | null;
        variation?: number | null;
      }>;
      summary: string;
    };
    calendar: {
      available: boolean;
      isHolidayToday: boolean;
      todayHolidayName: string | null;
      nextHoliday: { date: string; localName: string } | null;
      countryCode: string;
      weekdayLabel: string;
      summary: string;
    };
  } | null;
  insights: {
    alerts: DemoAlert[];
    opportunity: string;
    recommendation: string;
    contextFactors: Array<{
      factor: string;
      status: string;
      reading: string;
      possibleImpact: string;
    }>;
  } | null;
  dictionary: Array<{
    key: string;
    friendlyLabel: string;
    category: string;
    total: number;
    lastValue: unknown;
  }>;
  connection: {
    status: "ok" | "error";
    message: string;
    updatedAt: string;
  };
  range: {
    preset: DemoRangePreset;
    startTs: number;
    endTs: number;
  };
  updatedAt: string;
  debug: Record<string, unknown>;
}

const RANGE_OPTIONS: { value: DemoRangePreset; label: string }[] = [
  { value: "24h", label: "Últimas 24 hs" },
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
];

function formatTs(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatChartTs(ts: number, preset: DemoRangePreset): string {
  if (preset === "24h") {
    return new Date(ts).toLocaleString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return new Date(ts).toLocaleString("es-AR", {
    month: "short",
    day: "numeric",
  });
}

function isActiveValue(active: unknown): boolean {
  return active === true || active === "true" || active === 1 || active === "1";
}

function MetricCard({
  title,
  children,
  accent,
}: {
  title: string;
  children: React.ReactNode;
  accent?: "emerald" | "sky" | "amber" | "violet" | "rose";
}) {
  const accentClass =
    accent === "emerald"
      ? "from-emerald-500/20 to-transparent"
      : accent === "sky"
        ? "from-sky-500/20 to-transparent"
        : accent === "amber"
          ? "from-amber-500/20 to-transparent"
          : accent === "violet"
            ? "from-violet-500/20 to-transparent"
            : accent === "rose"
              ? "from-rose-500/20 to-transparent"
              : "from-zinc-500/10 to-transparent";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg shadow-black/20">
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${accentClass}`}
      />
      <p className="relative text-sm font-medium text-zinc-400">{title}</p>
      <div className="relative mt-3 space-y-1 text-zinc-100">{children}</div>
    </div>
  );
}

function alertStyles(type: DemoAlert["type"]) {
  if (type === "warning") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  }
  if (type === "opportunity") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  }
  return "border-sky-500/30 bg-sky-500/10 text-sky-100";
}

export default function DemoPage() {
  const [payload, setPayload] = useState<DemoPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [range, setRange] = useState<DemoRangePreset>("7d");
  const [debugOpen, setDebugOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ range });
      if (deviceId) params.set("deviceId", deviceId);
      const response = await fetch(`/api/demo?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as DemoPayload;
      setPayload(data);
      if (data.connection.status === "error") {
        setError(data.connection.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando demo");
    } finally {
      setLoading(false);
    }
  }, [deviceId, range]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const chartData = useMemo(() => {
    if (!payload?.metrics?.activitySeries) return [];
    return payload.metrics.activitySeries.map((point) => ({
      ...point,
      label: formatChartTs(point.ts, payload.range.preset),
    }));
  }, [payload]);

  const selectedDevice = payload?.device;
  const selectedDeviceId =
    deviceId ?? selectedDevice?.id ?? payload?.devices[0]?.id ?? "";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-zinc-950 to-zinc-950" />

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-400">
                Screen Intelligence
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Analítica contextual para pantallas digitales
              </h1>
              <p className="mt-3 max-w-2xl text-zinc-400">
                Lectura exploratoria de audiencia, contexto y oportunidades
                comerciales.
              </p>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:min-w-[320px]">
              <StatusPill
                label="Sensmi"
                value={
                  payload?.connection.status === "ok"
                    ? "Conectado"
                    : "Sin conexión"
                }
                ok={payload?.connection.status === "ok"}
              />
              <StatusPill
                label="Actualización"
                value={
                  payload?.updatedAt
                    ? formatTs(new Date(payload.updatedAt).getTime())
                    : "—"
                }
              />
              <StatusPill
                label="Pantalla"
                value={selectedDevice?.name ?? "—"}
              />
              <StatusPill
                label="Rango"
                value={
                  RANGE_OPTIONS.find((option) => option.value === range)
                    ?.label ?? range
                }
              />
            </div>
          </div>
        </header>

        {/* Controls */}
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-1 flex-col gap-2">
            <label
              htmlFor="device-select"
              className="text-sm font-medium text-zinc-400"
            >
              Pantalla / device
            </label>
            <select
              id="device-select"
              value={selectedDeviceId}
              onChange={(event) => setDeviceId(event.target.value)}
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none ring-indigo-500 focus:ring-2"
            >
              {(payload?.devices ?? []).map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name} ·{" "}
                  {isActiveValue(device.active) ? "Activo" : "Inactivo"}
                </option>
              ))}
            </select>
            {selectedDevice && (
              <p className="text-xs text-zinc-500">
                {selectedDevice.type ?? "Device"} · última actividad{" "}
                {formatTs(selectedDevice.lastActivityTime)} ·{" "}
                {selectedDevice.customer ?? payload?.location.clientName ?? "—"}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-400">Período</span>
            <div className="flex flex-wrap gap-2">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRange(option.value)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    range === option.value
                      ? "bg-indigo-600 text-white"
                      : "border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:opacity-50"
          >
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        {loading && !payload ? (
          <div className="flex h-64 items-center justify-center text-zinc-500">
            Cargando datos de la red…
          </div>
        ) : payload ? (
          <>
            {/* Location banner */}
            <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-5 py-4">
              <p className="text-sm text-zinc-400">Ubicación demo</p>
              <p className="mt-1 text-lg font-medium">
                {payload.location.locationName} · {payload.location.city},{" "}
                {payload.location.country}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                {payload.location.businessType} · {payload.location.screenType}
              </p>
            </div>

            {/* Main cards */}
            <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard title="Actividad detectada" accent="emerald">
                <p className="text-3xl font-semibold">
                  {payload.metrics?.totalInteractions ?? 0}
                </p>
                <p className="text-sm text-zinc-400">
                  interacciones en el período
                </p>
              </MetricCard>

              <MetricCard title="Pantalla / sensor" accent="sky">
                <p className="text-xl font-semibold">
                  {payload.metrics?.sensorStatus ?? "—"}
                </p>
                <p className="text-sm text-zinc-400">
                  Última actividad:{" "}
                  {formatTs(payload.metrics?.lastActivityTime)}
                </p>
                {payload.metrics?.lastRssi != null && (
                  <p className="text-sm text-zinc-400">
                    Señal RSSI: {payload.metrics.lastRssi}
                  </p>
                )}
              </MetricCard>

              <MetricCard title="Clima actual" accent="violet">
                {payload.context?.weather.available ? (
                  <>
                    <p className="text-3xl font-semibold">
                      {payload.context.weather.temperature != null
                        ? `${payload.context.weather.temperature}°C`
                        : "—"}
                    </p>
                    <p className="text-sm text-zinc-400">
                      {payload.context.weather.summary}
                      {payload.context.weather.rain != null &&
                      payload.context.weather.rain > 0
                        ? " · Lluvia"
                        : " · Sin lluvia"}
                    </p>
                    <p className="text-sm text-zinc-500">
                      Viento: {payload.context.weather.windSpeed ?? "—"} km/h
                    </p>
                  </>
                ) : (
                  <p className="text-zinc-400">Dato no disponible</p>
                )}
              </MetricCard>

              <MetricCard title="Contexto económico" accent="amber">
                {payload.context?.dollar.available ? (
                  <>
                    <p className="text-lg font-semibold">
                      {payload.context.dollar.summary}
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-zinc-400">
                      {payload.context.dollar.rates.map((rate) => (
                        <li key={rate.name}>
                          {rate.name}: compra ${rate.buy ?? "—"} · venta $
                          {rate.sell ?? "—"}
                          {rate.variation != null &&
                            ` · var ${rate.variation}%`}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-zinc-400">Dato no disponible</p>
                )}
              </MetricCard>

              <MetricCard title="Calendario" accent="rose">
                {payload.context?.calendar.available ? (
                  <>
                    <p className="text-lg font-semibold">
                      {payload.context.calendar.isHolidayToday
                        ? `Feriado: ${payload.context.calendar.todayHolidayName}`
                        : "Día hábil"}
                    </p>
                    <p className="text-sm capitalize text-zinc-400">
                      {payload.context.calendar.weekdayLabel}
                    </p>
                    {payload.context.calendar.nextHoliday && (
                      <p className="text-sm text-zinc-500">
                        Próximo feriado:{" "}
                        {payload.context.calendar.nextHoliday.localName} (
                        {payload.context.calendar.nextHoliday.date})
                      </p>
                    )}
                    <p className="text-xs text-zinc-500">
                      País: {payload.context.calendar.countryCode}
                    </p>
                  </>
                ) : (
                  <p className="text-zinc-400">Dato no disponible</p>
                )}
              </MetricCard>

              <MetricCard title="Oportunidad detectada" accent="emerald">
                <p className="text-base leading-relaxed text-zinc-200">
                  {payload.insights?.opportunity ??
                    "Monitorear actividad y contexto para detectar ventanas comerciales."}
                </p>
              </MetricCard>
            </div>

            {/* Activity chart */}
            <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
              <h2 className="text-lg font-semibold">Actividad en el tiempo</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Serie de interacciones agregadas por{" "}
                {range === "24h" ? "hora" : "día"}
              </p>
              {chartData.length > 0 ? (
                <div className="mt-6 h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#a1a1aa" }}
                      />
                      <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                      <Tooltip
                        contentStyle={{
                          background: "#18181b",
                          border: "1px solid #3f3f46",
                          borderRadius: 8,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        name="Actividad"
                        stroke="#818cf8"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-8 text-center text-sm text-zinc-500">
                  No hay datos suficientes para el rango seleccionado.
                </p>
              )}
            </section>

            {/* Context factors */}
            <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
              <h2 className="text-lg font-semibold">Factores de contexto</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Variables externas que pueden explicar variaciones de audiencia
              </p>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500">
                      <th className="pb-3 pr-4 font-medium">Factor</th>
                      <th className="pb-3 pr-4 font-medium">Estado</th>
                      <th className="pb-3 pr-4 font-medium">Lectura</th>
                      <th className="pb-3 font-medium">Posible impacto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payload.insights?.contextFactors ?? []).map((factor) => (
                      <tr
                        key={factor.factor}
                        className="border-b border-zinc-800/60"
                      >
                        <td className="py-3 pr-4 font-medium text-zinc-200">
                          {factor.factor}
                        </td>
                        <td className="py-3 pr-4 text-zinc-400">
                          {factor.status}
                        </td>
                        <td className="py-3 pr-4 text-zinc-400">
                          {factor.reading}
                        </td>
                        <td className="py-3 text-zinc-500">
                          {factor.possibleImpact}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Alerts + recommendation */}
            <div className="mb-8 grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                <h2 className="text-lg font-semibold">Alertas iniciales</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Señales automáticas basadas en actividad y contexto
                </p>
                <div className="mt-4 space-y-3">
                  {(payload.insights?.alerts ?? []).length > 0 ? (
                    payload.insights!.alerts.map((alert, index) => (
                      <div
                        key={`${alert.title}-${index}`}
                        className={`rounded-xl border p-4 ${alertStyles(alert.type)}`}
                      >
                        <p className="font-medium">{alert.title}</p>
                        <p className="mt-1 text-sm opacity-90">
                          {alert.explanation}
                        </p>
                        <p className="mt-2 text-xs opacity-75">
                          Acción sugerida: {alert.suggestedAction}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500">
                      Sin alertas para el escenario actual.
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/40 to-zinc-900/60 p-6">
                <h2 className="text-lg font-semibold">Sugerencia comercial</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Recomendación generada con reglas simples
                </p>
                <p className="mt-4 text-lg leading-relaxed text-indigo-100">
                  {payload.insights?.recommendation ??
                    "Mantener monitoreo de audiencia y contexto externo."}
                </p>
              </section>
            </div>

            {/* Dictionary */}
            <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <h2 className="text-lg font-semibold">
                Diccionario de métricas detectadas
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Las etiquetas son provisorias hasta validar el diccionario
                oficial con Sensmi.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500">
                      <th className="pb-3 pr-4 font-medium">Key técnica</th>
                      <th className="pb-3 pr-4 font-medium">
                        Etiqueta amigable
                      </th>
                      <th className="pb-3 pr-4 font-medium">Categoría</th>
                      <th className="pb-3 pr-4 font-medium">Total puntos</th>
                      <th className="pb-3 font-medium">Último valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.dictionary.map((entry) => (
                      <tr
                        key={entry.key}
                        className="border-b border-zinc-800/60"
                      >
                        <td className="py-2.5 pr-4 font-mono text-xs text-zinc-400">
                          {entry.key}
                        </td>
                        <td className="py-2.5 pr-4">{entry.friendlyLabel}</td>
                        <td className="py-2.5 pr-4 text-zinc-400">
                          {entry.category}
                        </td>
                        <td className="py-2.5 pr-4">{entry.total}</td>
                        <td className="py-2.5 font-mono text-xs text-zinc-500">
                          {String(entry.lastValue ?? "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Debug */}
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80">
              <button
                type="button"
                onClick={() => setDebugOpen((open) => !open)}
                className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-medium text-zinc-400 hover:text-zinc-200"
              >
                Debug técnico
                <span>{debugOpen ? "▲" : "▼"}</span>
              </button>
              {debugOpen && (
                <div className="border-t border-zinc-800 px-6 py-4">
                  <pre className="max-h-96 overflow-auto rounded-xl bg-black/40 p-4 text-xs text-zinc-400">
                    {JSON.stringify(payload.debug, null, 2)}
                  </pre>
                </div>
              )}
            </section>
          </>
        ) : null}

        <footer className="mt-10 pb-8 text-center text-xs text-zinc-600">
          Screen Intelligence · Demo express · Sensmi + contexto externo
        </footer>
      </div>
    </div>
  );
}

function StatusPill({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2">
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={`mt-0.5 truncate text-sm font-medium ${
          ok === true
            ? "text-emerald-400"
            : ok === false
              ? "text-rose-400"
              : "text-zinc-200"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
