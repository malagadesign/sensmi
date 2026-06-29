export interface DemoLocation {
  clientName: string;
  locationName: string;
  city: string;
  country: string;
  countryCode: "AR" | "UY" | "PY" | "CL";
  latitude: number;
  longitude: number;
  businessType: string;
  screenType: string;
}

interface DemoLocationRule {
  deviceId?: string;
  deviceNameIncludes?: string;
  location: DemoLocation;
}

const DEFAULT_LOCATION: DemoLocation = {
  clientName: "Cliente Demo Retail",
  locationName: "Sucursal Centro",
  city: "Buenos Aires",
  country: "Argentina",
  countryCode: "AR",
  latitude: -34.6037,
  longitude: -58.3816,
  businessType: "Retail",
  screenType: "Pantalla digital",
};

export const DEMO_LOCATION_RULES: DemoLocationRule[] = [
  {
    deviceNameIncludes: "PerfumesIoT",
    location: {
      clientName: "Cliente Demo Retail",
      locationName: "Sucursal Palermo",
      city: "Buenos Aires",
      country: "Argentina",
      countryCode: "AR",
      latitude: -34.5875,
      longitude: -58.4254,
      businessType: "Retail",
      screenType: "Vidriera digital",
    },
  },
  {
    deviceNameIncludes: "WOWLabs",
    location: {
      clientName: "WOWLabs",
      locationName: "Showroom Montevideo",
      city: "Montevideo",
      country: "Uruguay",
      countryCode: "UY",
      latitude: -34.9011,
      longitude: -56.1645,
      businessType: "Retail tech",
      screenType: "Pantalla interactiva",
    },
  },
  {
    deviceNameIncludes: "LS445",
    location: {
      clientName: "Red regional",
      locationName: "Punto Santiago",
      city: "Santiago",
      country: "Chile",
      countryCode: "CL",
      latitude: -33.4489,
      longitude: -70.6693,
      businessType: "Retail",
      screenType: "Pantalla digital",
    },
  },
];

export function resolveDemoLocation(
  deviceId: string,
  deviceName: string,
): DemoLocation {
  for (const rule of DEMO_LOCATION_RULES) {
    if (rule.deviceId && rule.deviceId === deviceId) return rule.location;
    if (
      rule.deviceNameIncludes &&
      deviceName.toLowerCase().includes(rule.deviceNameIncludes.toLowerCase())
    ) {
      return rule.location;
    }
  }
  return DEFAULT_LOCATION;
}
