import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Sensmi Platform API
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Integración Sensmi
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Pruebas técnicas y prototipo de dashboard exploratorio.
        </p>
      </div>

      <nav className="flex flex-col gap-3">
        <Link
          href="/sensmi-dashboard"
          className="rounded-xl border border-zinc-200 bg-white px-5 py-4 text-lg font-medium text-zinc-900 shadow-sm transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
        >
          Dashboard exploratorio — demo comercial
        </Link>
        <Link
          href="/sensmi-telemetry-test"
          className="rounded-xl border border-zinc-200 bg-white px-5 py-4 font-medium text-zinc-700 shadow-sm transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
        >
          Prueba de telemetría →
        </Link>
        <Link
          href="/sensmi-test"
          className="rounded-xl border border-zinc-200 bg-white px-5 py-4 font-medium text-zinc-700 shadow-sm transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
        >
          Prueba de integración básica →
        </Link>
      </nav>
    </main>
  );
}
