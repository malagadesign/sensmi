import type { DemoContextResult } from "./demo-context";
import type { DemoLocation } from "./demo-locations";

export type DemoAlertType = "info" | "warning" | "opportunity";

export interface DemoAlert {
  type: DemoAlertType;
  title: string;
  explanation: string;
  suggestedAction: string;
}

export interface DemoInsightsInput {
  metrics: {
    totalInteractions: number;
    engagementTotal: number;
    telemetryPointCount: number;
    sensorStatus: "Activo" | "Inactivo" | "Desconocido";
    lastRssi: number | null;
  };
  context: DemoContextResult;
  location: DemoLocation;
}

export interface DemoInsightsResult {
  alerts: DemoAlert[];
  opportunity: string;
  recommendation: string;
  contextFactors: Array<{
    factor: string;
    status: string;
    reading: string;
    possibleImpact: string;
  }>;
}

function isDeviceInactive(status: DemoInsightsInput["metrics"]["sensorStatus"]) {
  return status === "Inactivo" || status === "Desconocido";
}

export function buildDemoInsights(input: DemoInsightsInput): DemoInsightsResult {
  const { metrics, context, location } = input;
  const alerts: DemoAlert[] = [];
  const rain = context.weather.rain ?? 0;

  if (isDeviceInactive(metrics.sensorStatus)) {
    alerts.push({
      type: "warning",
      title: "Dispositivo sin reporte activo",
      explanation: "El dispositivo no está reportando actualmente.",
      suggestedAction: "Priorizar revisión técnica antes de tomar decisiones comerciales.",
    });
  }

  if (metrics.telemetryPointCount === 0) {
    alerts.push({
      type: "warning",
      title: "Sin eventos recientes",
      explanation: "No se detectaron eventos recientes para esta pantalla.",
      suggestedAction: "Ampliar el rango consultado o validar conectividad del sensor.",
    });
  }

  if (context.weather.available && rain > 0) {
    alerts.push({
      type: "warning",
      title: "Condición climática adversa",
      explanation: "La lluvia puede afectar circulación peatonal frente a la pantalla.",
      suggestedAction: "Considerar campañas de cercanía o mensajes adaptados al clima.",
    });
  }

  if (metrics.totalInteractions > 0 && rain === 0 && metrics.sensorStatus === "Activo") {
    alerts.push({
      type: "opportunity",
      title: "Actividad en condiciones normales",
      explanation: "Hay actividad detectada con clima favorable para circulación.",
      suggestedAction: "Buen escenario para evaluar campañas tácticas o pruebas A/B.",
    });
  }

  if (
    metrics.telemetryPointCount > 0 &&
    metrics.engagementTotal === 0 &&
    metrics.totalInteractions === 0
  ) {
    alerts.push({
      type: "info",
      title: "Engagement limitado",
      explanation:
        "La pantalla reporta datos, pero no registra engagement significativo.",
      suggestedAction: "Revisar creatividad, ubicación o relevancia del contenido.",
    });
  }

  if (context.calendar.isHolidayToday) {
    alerts.push({
      type: "info",
      title: "Comportamiento atípico por calendario",
      explanation: "Hoy es feriado en la ubicación de la pantalla.",
      suggestedAction: "Comparar resultados contra días hábiles equivalentes.",
    });
  }

  let opportunity = "Monitorear actividad y contexto para detectar ventanas comerciales.";
  if (isDeviceInactive(metrics.sensorStatus)) {
    opportunity = "El sensor está inactivo. Revisar conectividad antes de analizar performance.";
  } else if (metrics.totalInteractions > 0 && rain === 0) {
    opportunity =
      "Hay actividad reciente y clima favorable. Buen momento para campañas tácticas.";
  } else if (metrics.totalInteractions > 0 && rain > 0) {
    opportunity =
      "Hay actividad reciente con lluvia. Puede ser útil reforzar promociones de cercanía.";
  } else if (metrics.totalInteractions === 0 && rain > 0) {
    opportunity =
      "Baja actividad y lluvia. Conviene ajustar expectativas y reforzar mensajes contextuales.";
  } else if (metrics.totalInteractions === 0) {
    opportunity =
      "Hay baja actividad en el período. Revisar contenido, ubicación o conectividad.";
  }

  let recommendation = "Mantener monitoreo de audiencia y contexto externo.";
  if (rain > 0) {
    recommendation = "Sugerir campaña contextual asociada al clima.";
  } else if (metrics.totalInteractions === 0) {
    recommendation = "Revisar creatividad o activar promoción más directa.";
  } else if (metrics.totalInteractions > 0 && metrics.sensorStatus === "Activo") {
    recommendation = "Aprovechar ventana de circulación para pauta táctica.";
  }
  if (isDeviceInactive(metrics.sensorStatus)) {
    recommendation =
      "Priorizar revisión técnica antes de tomar decisiones comerciales.";
  }

  const contextFactors = [
    {
      factor: "Clima",
      status: context.weather.available ? context.weather.summary : "No disponible",
      reading:
        context.weather.temperature != null
          ? `${context.weather.temperature}°C · viento ${context.weather.windSpeed ?? "—"} km/h`
          : "Dato no disponible",
      possibleImpact:
        rain > 0
          ? "Puede reducir circulación peatonal."
          : "Condiciones favorables para comparar performance.",
    },
    {
      factor: "Día de semana",
      status: context.calendar.weekdayLabel,
      reading: context.calendar.summary,
      possibleImpact: "Comparar contra promedios de días equivalentes.",
    },
    {
      factor: "Calendario",
      status: context.calendar.isHolidayToday ? "Feriado" : "No feriado",
      reading: context.calendar.isHolidayToday
        ? context.calendar.todayHolidayName ?? "Feriado"
        : context.calendar.nextHoliday
          ? `Próximo: ${context.calendar.nextHoliday.localName} (${context.calendar.nextHoliday.date})`
          : "Sin próximo feriado cargado",
      possibleImpact: context.calendar.isHolidayToday
        ? "El comportamiento puede diferir por calendario."
        : "Permite lectura estándar de tráfico.",
    },
    {
      factor: "Dólar",
      status: context.dollar.available ? "Disponible" : "No disponible",
      reading: context.dollar.summary,
      possibleImpact:
        "Puede afectar intención de compra en categorías sensibles al precio.",
    },
    {
      factor: "Estado del device",
      status: metrics.sensorStatus,
      reading:
        metrics.lastRssi != null
          ? `Señal RSSI ${metrics.lastRssi}`
          : "Sin dato de señal",
      possibleImpact:
        metrics.sensorStatus === "Activo"
          ? "Fuente confiable para analítica."
          : "Limita la confianza en la lectura comercial.",
    },
    {
      factor: "Ubicación demo",
      status: location.locationName,
      reading: `${location.city}, ${location.country}`,
      possibleImpact: `Contexto ${location.businessType} · ${location.screenType}`,
    },
  ];

  return {
    alerts,
    opportunity,
    recommendation,
    contextFactors,
  };
}
