"use client";

import { useCallback, useEffect, useState } from "react";

import type { SensmiTestResult } from "@/lib/sensmi-test";

type FetchState = "idle" | "loading" | "done" | "error";

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
        ok
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
      }`}
    >
      {label}
    </span>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h2>
      {children}
    </section>
  );
}

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-4 text-xs leading-relaxed text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function formatKeys(data: unknown): string {
  if (Array.isArray(data)) {
    return data.length > 0 ? data.join(", ") : "(sin keys)";
  }
  if (data && typeof data === "object") {
    const keys = Object.keys(data as Record<string, unknown>);
    return keys.length > 0 ? keys.join(", ") : "(sin keys)";
  }
  return data ? String(data) : "(sin datos)";
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

export default function SensmiTestPage() {
  const [state, setState] = useState<FetchState>("idle");
  const [result, setResult] = useState<SensmiTestResult | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const runTest = useCallback(async () => {
    setState("loading");
    setFetchError(null);

    try {
      const response = await fetch("/api/sensmi/test", { cache: "no-store" });
      const data = (await response.json()) as SensmiTestResult & {
        error?: string;
      };

      if (!response.ok && data.error) {
        setFetchError(data.error);
        setResult(null);
        setState("error");
        return;
      }

      setResult(data);
      setState("done");
    } catch (error) {
      setFetchError(
        error instanceof Error ? error.message : "No se pudo contactar al servidor",
      );
      setResult(null);
      setState("error");
    }
  }, []);

  useEffect(() => {
    runTest();
  }, [runTest]);

  const connected = result?.login.status === "ok";

  const handleDownload = () => {
    if (!result) return;
    const date = new Date(result.timestamp).toISOString().slice(0, 19).replace(/:/g, "-");
    downloadJson(result, `sensmi-test-${date}.json`);
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Sensmi — Prueba de integración
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Diagnóstico de conexión, autenticación y lectura básica de datos vía
            backend.
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
        <p className="text-sm text-zinc-500">Conectando con Sensmi Platform API…</p>
      )}

      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Error al ejecutar la prueba: {fetchError}
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-5">
          <Section title="Estado de conexión">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge
                ok={connected}
                label={connected ? "Conectado" : "Sin conexión"}
              />
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Base URL: <code className="font-mono">{result.baseUrl}</code>
              </span>
              {result.login.tokenPreview && (
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  Token: <code className="font-mono">{result.login.tokenPreview}</code>
                </span>
              )}
            </div>
            {result.login.message && (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {result.login.message}
              </p>
            )}
          </Section>

          <div className="grid gap-5 md:grid-cols-2">
            <Section title="Customers">
              {result.customers.error ? (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {result.customers.error}
                </p>
              ) : (
                <>
                  <p className="text-2xl font-semibold">{result.customers.count}</p>
                  <p className="mt-1 text-sm text-zinc-500">registros encontrados</p>
                  {result.customers.first && (
                    <div className="mt-3">
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Primer customer
                      </p>
                      <JsonBlock data={result.customers.first} />
                    </div>
                  )}
                </>
              )}
            </Section>

            <Section title="Devices">
              {result.devices.error ? (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {result.devices.error}
                </p>
              ) : (
                <>
                  <p className="text-2xl font-semibold">{result.devices.count}</p>
                  <p className="mt-1 text-sm text-zinc-500">registros encontrados</p>
                  {result.devices.first && (
                    <div className="mt-3">
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Primer device
                      </p>
                      <JsonBlock data={result.devices.first} />
                    </div>
                  )}
                </>
              )}
            </Section>
          </div>

          <Section title="Telemetría del primer device">
            {result.telemetry.deviceId ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Device ID:{" "}
                  <code className="font-mono">{result.telemetry.deviceId}</code>
                </p>

                <div>
                  <p className="mb-1 text-sm font-medium">Attribute keys</p>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    {formatKeys(result.telemetry.attributeKeys)}
                  </p>
                  {result.telemetry.attributeKeys !== null && (
                    <div className="mt-2">
                      <JsonBlock data={result.telemetry.attributeKeys} />
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-sm font-medium">Timeseries keys</p>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    {formatKeys(result.telemetry.timeseriesKeys)}
                  </p>
                  {result.telemetry.timeseriesKeys !== null && (
                    <div className="mt-2">
                      <JsonBlock data={result.telemetry.timeseriesKeys} />
                    </div>
                  )}
                </div>

                {result.telemetry.errors.length > 0 && (
                  <ul className="list-inside list-disc text-sm text-red-600 dark:text-red-400">
                    {result.telemetry.errors.map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">
                No hay devices disponibles para consultar telemetría.
              </p>
            )}
          </Section>

          {result.errors.length > 0 && (
            <Section title="Errores">
              <ul className="list-inside list-disc text-sm text-red-600 dark:text-red-400">
                {result.errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Respuesta cruda (JSON)">
            <JsonBlock data={result} />
          </Section>
        </div>
      )}
    </main>
  );
}
