const COUNTRY_ADJECTIVE_MAP: Record<string, string> = {
  french: 'france',
  german: 'germany',
  spanish: 'spain',
  italian: 'italy',
  dutch: 'netherlands',
  belgian: 'belgium',
  swiss: 'switzerland',
  austrian: 'austria',
  portuguese: 'portugal',
  british: 'united kingdom',
  english: 'united kingdom',
  scottish: 'scotland',
  welsh: 'wales',
  irish: 'ireland',
  american: 'united states',
  canadian: 'canada',
  mexican: 'mexico',
  brazilian: 'brazil',
  argentinian: 'argentina',
  argentine: 'argentina',
  australian: 'australia',
  indian: 'india',
  indonesian: 'indonesia',
  japanese: 'japan',
  korean: 'south korea',
  chinese: 'china',
  thai: 'thailand',
  vietnamese: 'vietnam',
};

interface GeocodingResult {
  latitude: number;
  longitude: number;
  name: string;
}

interface GeocodingResponse {
  results?: GeocodingResult[];
}

function normalizeLocationQuery(location: string): string {
  return location
    .trim()
    .replace(/\s+/g, ' ')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => COUNTRY_ADJECTIVE_MAP[part.toLowerCase()] || part)
    .join(', ');
}

function buildLocationCandidates(location: string): string[] {
  const normalized = normalizeLocationQuery(location);
  const candidates = new Set<string>([location.trim(), normalized]);

  if (normalized.includes(',')) {
    candidates.add(
      normalized
        .split(',')
        .map(part => part.trim())
        .filter(Boolean)
        .join(', '),
    );
  }

  return [...candidates].filter(Boolean);
}

export async function resolveLocation(location: string): Promise<GeocodingResult> {
  const candidates = buildLocationCandidates(location);

  for (const candidate of candidates) {
    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(candidate)}&count=1`;
    const geocodingResponse = await fetch(geocodingUrl);
    const geocodingData = (await geocodingResponse.json()) as GeocodingResponse;
    const result = geocodingData.results?.[0];

    if (result) {
      return result;
    }
  }

  const suggestion = normalizeLocationQuery(location);
  if (suggestion !== location.trim()) {
    throw new Error(`Location '${location}' not found. Try '${suggestion}' instead.`);
  }

  throw new Error(`Location '${location}' not found`);
}
