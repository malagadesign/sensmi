"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  CategorySummaryItem,
  DashboardDataResult,
  DashboardDevice,
  DictionaryEntry,
  TopZoneOrProduct,
} from "@/lib/sensmi-dashboard";
import {
  DAY_MS,
  HOUR_MS,
  MS_24H,
  MS_30D,
  MS_7D,
} from "@/lib/sensmi-dashboard";

type RangePreset = "24h" | "7d" | "30d" | "custom";
type Aggregation = "none" | "hour" | "day";

function formatTs(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatChartTs(ts: number): string {
  return new Date(ts).toLocaleString("es-AR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
  });
}

function isActiveValue(active: unknown): boolean {
  return active === true || active === "true" || active === 1 || active === "1";
}

function BusinessCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm font-medium text-zinc-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function ActivityChart({
  series,
}: {
  series: DashboardDataResult["activitySeries"];
}) {
  const data = series.map((point) => ({
    ...point,
    label: formatChartTs(point.ts),
  }));

  if (data.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Sin actividad registrada en el rango seleccionado.
      </p>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="value"
            name="Interacciones"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TopZonesChart({ items }: { items: TopZoneOrProduct[] }) {
  const data = items.slice(0, 10).map((item) => ({
    name: item.friendlyLabel,
    total: item.total,
  }));

  if (data.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No hay productos o zonas con actividad en este rango.
      </p>
    );
  }

  return (
    <div className="h-96 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={180}
            tick={{ fontSize: 11 }}
          />
          <Tooltip />
          <Bar dataKey="total" fill="#4f46e5" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoriesTable({ items }: { items: CategorySummaryItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">Sin categorías con datos.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="py-2 pr-4 font-medium text-zinc-500">Categoría</th>
            <th className="py-2 pr-4 font-medium text-zinc-500">Keys</th>
            <th className="py-2 pr-4 font-medium text-zinc-500">Puntos</th>
            <th className="py-2 pr-4 font-medium text-zinc-500">Total</th>
            <th className="py-2 font-medium text-zinc-500">Último dato</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.category}
              className="border-b border-zinc-100 dark:border-zinc-900"
            >
              <td className="py-2 pr-4">{item.category}</td>
              <td className="py-2 pr-4">{item.keyCount}</td>
              <td className="py-2 pr-4">{item.pointCount}</td>
              <td className="py-2 pr-4">{item.totalValue}</td>
              <td className="py-2">{formatTs(item.lastTs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DictionaryTable({ entries }: { entries: DictionaryEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-zinc-500">Sin métricas clasificadas.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="py-2 pr-4 font-medium text-zinc-500">
              Etiqueta provisoria
            </th>
            <th className="py-2 pr-4 font-medium text-zinc-500">Categoría</th>
            <th className="py-2 pr-4 font-medium text-zinc-500">Eventos</th>
            <th className="py-2 pr-4 font-medium text-zinc-500">Total</th>
            <th className="py-2 pr-4 font-medium text-zinc-500">Último valor</th>
            <th className="py-2 font-medium text-zinc-500">Estado</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.technicalKey}
              className="border-b border-zinc-100 dark:border-zinc-900"
            >
              <td className="py-2 pr-4">{entry.friendlyLabel}</td>
              <td className="py-2 pr-4">{entry.category}</td>
              <td className="py-2 pr-4">{entry.pointCount}</td>
              <td className="py-2 pr-4">{entry.totalValue}</td>
              <td className="py-2 pr-4">
                <span>{String(entry.lastValue ?? "—")}</span>
                {entry.lastTs && (
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    {formatTs(entry.lastTs)}
                  </span>
                )}
              </td>
              <td className="py-2">
                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  {entry.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SensmiDashboardPage() {
  const [devices, setDevices] = useState<DashboardDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [rangePreset, setRangePreset] = useState<RangePreset>("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [aggregation, setAggregation] = useState<Aggregation>("hour");
  const [data, setData] = useState<DashboardDataResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { startTs, endTs } = useMemo(() => {
    const now = Date.now();
    if (rangePreset === "24h") return { startTs: now - MS_24H, endTs: now };
    if (rangePreset === "7d") return { startTs: now - MS_7D, endTs: now };
    if (rangePreset === "30d") return { startTs: now - MS_30D, endTs: now };
    return {
      startTs: customStart ? new Date(customStart).getTime() : now - MS_7D,
      endTs: customEnd ? new Date(customEnd).getTime() : now,
    };
  }, [rangePreset, customStart, customEnd]);

  const aggParams = useMemo(() => {
    if (aggregation === "none") return { agg: "none", interval: undefined };
    if (aggregation === "hour") return { agg: "SUM", interval: HOUR_MS };
    return { agg: "SUM", interval: DAY_MS };
  }, [aggregation]);

  useEffect(() => {
    fetch("/api/sensmi/devices", { cache: "no-store" })
      .then((res) => res.json())
      .then((json: { devices?: DashboardDevice[]; error?: string }) => {
        if (json.error) throw new Error(json.error);
        const list = json.devices ?? [];
        setDevices(list);

        const perfumes = list.find(
          (d) => d.name.toLowerCase() === "perfumesiot",
        );
        const active = list.find((d) => isActiveValue(d.active));
        setSelectedDeviceId(
          perfumes?.id ?? active?.id ?? list[0]?.id ?? "",
        );
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Error cargando devices"),
      );
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!selectedDeviceId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        deviceId: selectedDeviceId,
        startTs: String(startTs),
        endTs: String(endTs),
        agg: aggParams.agg,
      });

      if (aggParams.interval) {
        params.set("interval", String(aggParams.interval));
      }

      const response = await fetch(`/api/sensmi/dashboard-data?${params}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as DashboardDataResult & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(json.error ?? "Error cargando dashboard");
      }

      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando dashboard");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedDeviceId, startTs, endTs, aggParams]);

  useEffect(() => {
    if (selectedDeviceId) loadDashboard();
  }, [selectedDeviceId, loadDashboard]);

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Sensmi Analytics
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Comportamiento e interacción
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
          Lectura exploratoria de comportamiento e interacción desde dispositivos
          Sensmi.
        </p>

        {data && (
          <div className="mt-5 flex flex-wrap gap-4 text-sm text-zinc-700 dark:text-zinc-300">
            <span>
              <strong>Device:</strong> {data.device.name}
            </span>
            <span>
              <strong>Estado:</strong> {data.businessSummary.sensorStatus}
            </span>
            <span>
              <strong>Última actividad:</strong>{" "}
              {formatTs(data.businessSummary.lastActivityTime)}
            </span>
            <span>
              <strong>Rango:</strong> {formatTs(data.range.startTs)} →{" "}
              {formatTs(data.range.endTs)}
            </span>
          </div>
        )}
      </header>

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
        Las etiquetas de productos y zonas son provisorias hasta validar el
        diccionario de métricas con Sensmi.
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-600">Dispositivo</span>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                  {isActiveValue(device.active) ? " · activo" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-600">Rango</span>
            <select
              value={rangePreset}
              onChange={(e) => setRangePreset(e.target.value as RangePreset)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="24h">Últimas 24h</option>
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-600">Agrupación</span>
            <select
              value={aggregation}
              onChange={(e) => setAggregation(e.target.value as Aggregation)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="none">Sin agrupar</option>
              <option value="hour">Por hora</option>
              <option value="day">Por día</option>
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={loadDashboard}
              disabled={loading || !selectedDeviceId}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {loading ? "Cargando…" : "Actualizar"}
            </button>
          </div>
        </div>

        {rangePreset === "custom" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-600">Desde</span>
              <input
                type="datetime-local"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-600">Hasta</span>
              <input
                type="datetime-local"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {data && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <BusinessCard
              title="Interacciones totales"
              value={String(data.businessSummary.totalInteractions)}
              hint="Basado en Engagement o actividad RFID/DPU/DPB"
            />
            <BusinessCard
              title="Productos / zonas con actividad"
              value={String(data.businessSummary.activeZonesOrProducts)}
              hint="Keys con datos en el rango"
            />
            <BusinessCard
              title="Tráfico detectado"
              value={String(data.businessSummary.totalTraffic)}
            />
            <BusinessCard
              title="Convergencia"
              value={
                data.businessSummary.convergenceValue != null
                  ? String(data.businessSummary.convergenceValue)
                  : "—"
              }
            />
            <BusinessCard
              title="Última actividad"
              value={formatTs(data.businessSummary.lastActivityTime)}
            />
            <BusinessCard
              title="Estado del sensor"
              value={data.businessSummary.sensorStatus}
              hint={
                data.businessSummary.lastRssi != null
                  ? `Calidad de señal (RSSI): ${data.businessSummary.lastRssi}`
                  : "Sin dato de señal"
              }
            />
          </section>

          <Section
            title="Actividad en el tiempo"
            description="Evolución de interacciones detectadas durante el rango seleccionado."
          >
            <ActivityChart series={data.activitySeries} />
          </Section>

          <Section
            title="Productos o zonas con más actividad"
            description="Ranking por volumen de eventos en el período consultado."
          >
            <TopZonesChart items={data.topZonesOrProducts} />
          </Section>

          <Section title="Resumen por categoría">
            <CategoriesTable items={data.categoriesSummary} />
          </Section>

          <Section
            title="Diccionario a validar"
            description="Estas métricas fueron detectadas y clasificadas de forma provisoria. Para una versión final necesitamos validar con Sensmi o con el cliente qué representa cada código."
          >
            <DictionaryTable entries={data.dictionary} />
          </Section>

          {data.pendingDictionaryKeys.length > 0 && (
            <Section title="Métricas sin clasificar">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Keys detectadas que aún no tienen categoría de negocio:{" "}
                <span className="font-mono text-xs">
                  {data.pendingDictionaryKeys.join(", ")}
                </span>
              </p>
            </Section>
          )}

          <details className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <summary className="cursor-pointer text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Debug técnico
            </summary>
            <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-100 p-4 text-xs leading-relaxed text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
              {JSON.stringify(data.debug, null, 2)}
            </pre>
          </details>
        </>
      )}

      {!data && !loading && !error && selectedDevice && (
        <p className="text-sm text-zinc-500">
          Cargando analítica para {selectedDevice.name}…
        </p>
      )}
    </main>
  );
}
