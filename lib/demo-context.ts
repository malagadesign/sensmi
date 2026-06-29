export interface DemoWeather {
  available: boolean;
  temperature: number | null;
  rain: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  weatherCode: number | null;
  summary: string;
  error?: string;
}

export interface DemoDollarRate {
  name: string;
  buy: number | null;
  sell: number | null;
  variation?: number | null;
}

export interface DemoDollarContext {
  available: boolean;
  rates: DemoDollarRate[];
  summary: string;
  error?: string;
}

export interface DemoHoliday {
  date: string;
  localName: string;
  name: string;
}

export interface DemoCalendarContext {
  available: boolean;
  countryCode: string;
  isHolidayToday: boolean;
  todayHolidayName: string | null;
  nextHoliday: DemoHoliday | null;
  weekdayLabel: string;
  summary: string;
  error?: string;
}

export interface DemoContextResult {
  weather: DemoWeather;
  dollar: DemoDollarContext;
  calendar: DemoCalendarContext;
  errors: string[];
}

const WEATHER_CODES: Record<number, string> = {
  0: "Despejado",
  1: "Mayormente despejado",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Niebla",
  48: "Niebla con escarcha",
  51: "Llovizna ligera",
  53: "Llovizna moderada",
  55: "Llovizna intensa",
  61: "Lluvia ligera",
  63: "Lluvia moderada",
  65: "Lluvia intensa",
  80: "Chubascos ligeros",
  81: "Chubascos moderados",
  82: "Chubascos intensos",
};

function weatherSummary(code: number | null, rain: number | null): string {
  if (rain != null && rain > 0) return "Lluvia detectada";
  if (code != null && WEATHER_CODES[code]) return WEATHER_CODES[code];
  return "Condición no disponible";
}

async function fetchWeather(
  latitude: number,
  longitude: number,
): Promise<DemoWeather> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,precipitation,rain,weather_code,wind_speed_10m",
  );
  url.searchParams.set("timezone", "auto");

  try {
    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) {
      return {
        available: false,
        temperature: null,
        rain: null,
        precipitation: null,
        windSpeed: null,
        weatherCode: null,
        summary: "Dato no disponible",
        error: `HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      current?: {
        temperature_2m?: number;
        precipitation?: number;
        rain?: number;
        weather_code?: number;
        wind_speed_10m?: number;
      };
    };

    const current = data.current ?? {};
    const rain = current.rain ?? 0;
    const precipitation = current.precipitation ?? 0;

    return {
      available: true,
      temperature: current.temperature_2m ?? null,
      rain,
      precipitation,
      windSpeed: current.wind_speed_10m ?? null,
      weatherCode: current.weather_code ?? null,
      summary: weatherSummary(current.weather_code ?? null, rain),
    };
  } catch (error) {
    return {
      available: false,
      temperature: null,
      rain: null,
      precipitation: null,
      windSpeed: null,
      weatherCode: null,
      summary: "Dato no disponible",
      error: error instanceof Error ? error.message : "Error de clima",
    };
  }
}

async function fetchDollar(): Promise<DemoDollarContext> {
  try {
    const response = await fetch("https://dolarapi.com/v1/dolares", {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        available: false,
        rates: [],
        summary: "Dato no disponible",
        error: `HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as Array<{
      casa?: string;
      nombre?: string;
      compra?: number;
      venta?: number;
      variacion?: number;
    }>;

    const preferred = ["oficial", "blue", "tarjeta", "mep"];
    const rates: DemoDollarRate[] = data
      .filter((item) =>
        preferred.includes(String(item.casa ?? item.nombre ?? "").toLowerCase()),
      )
      .slice(0, 3)
      .map((item) => ({
        name: item.nombre ?? item.casa ?? "Dólar",
        buy: item.compra ?? null,
        sell: item.venta ?? null,
        variation: item.variacion ?? null,
      }));

    const blue = rates.find((rate) => rate.name.toLowerCase().includes("blue"));
    const official = rates.find((rate) =>
      rate.name.toLowerCase().includes("oficial"),
    );
    const headline = blue ?? official ?? rates[0];

    return {
      available: rates.length > 0,
      rates,
      summary: headline?.sell
        ? `${headline.name}: $${headline.sell}`
        : "Cotizaciones disponibles",
    };
  } catch (error) {
    return {
      available: false,
      rates: [],
      summary: "Dato no disponible",
      error: error instanceof Error ? error.message : "Error de dólar",
    };
  }
}

async function fetchCalendar(countryCode: string): Promise<DemoCalendarContext> {
  const year = new Date().getFullYear();
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const weekdayLabel = today.toLocaleDateString("es-AR", { weekday: "long" });

  try {
    const response = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      return {
        available: false,
        countryCode,
        isHolidayToday: false,
        todayHolidayName: null,
        nextHoliday: null,
        weekdayLabel,
        summary: "Dato no disponible",
        error: `HTTP ${response.status}`,
      };
    }

    const holidays = (await response.json()) as DemoHoliday[];
    const todayHoliday = holidays.find((holiday) => holiday.date === todayIso);
    const nextHoliday =
      holidays
        .filter((holiday) => holiday.date >= todayIso)
        .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;

    return {
      available: true,
      countryCode,
      isHolidayToday: Boolean(todayHoliday),
      todayHolidayName: todayHoliday?.localName ?? todayHoliday?.name ?? null,
      nextHoliday,
      weekdayLabel,
      summary: todayHoliday
        ? `Feriado: ${todayHoliday.localName}`
        : `Día hábil (${weekdayLabel})`,
    };
  } catch (error) {
    return {
      available: false,
      countryCode,
      isHolidayToday: false,
      todayHolidayName: null,
      nextHoliday: null,
      weekdayLabel,
      summary: "Dato no disponible",
      error: error instanceof Error ? error.message : "Error de calendario",
    };
  }
}

export async function fetchDemoContext(params: {
  latitude: number;
  longitude: number;
  countryCode: string;
}): Promise<DemoContextResult> {
  const [weather, dollar, calendar] = await Promise.all([
    fetchWeather(params.latitude, params.longitude),
    fetchDollar(),
    fetchCalendar(params.countryCode),
  ]);

  const errors = [weather.error, dollar.error, calendar.error].filter(
    Boolean,
  ) as string[];

  return { weather, dollar, calendar, errors };
}
