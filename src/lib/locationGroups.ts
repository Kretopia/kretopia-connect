/**
 * Hierarchical location data: Country/Region → Cities
 * Used for cascading filter dropdowns and intelligent matching.
 */

export interface LocationCountry {
  value: string;
  label: string;
  flag: string;
  cities: { value: string; label: string }[];
}

export const LOCATION_HIERARCHY: LocationCountry[] = [
  {
    value: 'Trinidad & Tobago',
    label: 'Trinidad & Tobago',
    flag: '🇹🇹',
    cities: [
      { value: 'Port of Spain, Trinidad', label: 'Port of Spain' },
      { value: 'San Fernando, Trinidad', label: 'San Fernando' },
      { value: 'Chaguanas, Trinidad', label: 'Chaguanas' },
      { value: 'Tobago', label: 'Tobago' },
    ],
  },
  {
    value: 'Jamaica',
    label: 'Jamaica',
    flag: '🇯🇲',
    cities: [
      { value: 'Kingston, Jamaica', label: 'Kingston' },
      { value: 'Montego Bay, Jamaica', label: 'Montego Bay' },
    ],
  },
  {
    value: 'Barbados',
    label: 'Barbados',
    flag: '🇧🇧',
    cities: [
      { value: 'Bridgetown, Barbados', label: 'Bridgetown' },
    ],
  },
  {
    value: 'United States',
    label: 'United States',
    flag: '🇺🇸',
    cities: [
      { value: 'Los Angeles, CA', label: 'Los Angeles, CA' },
      { value: 'New York, NY', label: 'New York, NY' },
      { value: 'Atlanta, GA', label: 'Atlanta, GA' },
      { value: 'Miami, FL', label: 'Miami, FL' },
      { value: 'Nashville, TN', label: 'Nashville, TN' },
      { value: 'Chicago, IL', label: 'Chicago, IL' },
      { value: 'Austin, TX', label: 'Austin, TX' },
      { value: 'San Francisco, CA', label: 'San Francisco, CA' },
      { value: 'Houston, TX', label: 'Houston, TX' },
      { value: 'Dallas, TX', label: 'Dallas, TX' },
      { value: 'Denver, CO', label: 'Denver, CO' },
      { value: 'Seattle, WA', label: 'Seattle, WA' },
      { value: 'Portland, OR', label: 'Portland, OR' },
      { value: 'Detroit, MI', label: 'Detroit, MI' },
      { value: 'Philadelphia, PA', label: 'Philadelphia, PA' },
      { value: 'Washington, DC', label: 'Washington, DC' },
    ],
  },
  {
    value: 'United Kingdom',
    label: 'United Kingdom',
    flag: '🇬🇧',
    cities: [
      { value: 'London, UK', label: 'London' },
      { value: 'Manchester, UK', label: 'Manchester' },
      { value: 'Birmingham, UK', label: 'Birmingham' },
      { value: 'Bristol, UK', label: 'Bristol' },
      { value: 'Glasgow, UK', label: 'Glasgow' },
      { value: 'Leeds, UK', label: 'Leeds' },
    ],
  },
  {
    value: 'Canada',
    label: 'Canada',
    flag: '🇨🇦',
    cities: [
      { value: 'Toronto, Canada', label: 'Toronto' },
      { value: 'Vancouver, Canada', label: 'Vancouver' },
      { value: 'Montreal, Canada', label: 'Montreal' },
      { value: 'Calgary, Canada', label: 'Calgary' },
    ],
  },
  {
    value: 'Nigeria',
    label: 'Nigeria',
    flag: '🇳🇬',
    cities: [
      { value: 'Lagos, Nigeria', label: 'Lagos' },
      { value: 'Abuja, Nigeria', label: 'Abuja' },
    ],
  },
  {
    value: 'Germany',
    label: 'Germany',
    flag: '🇩🇪',
    cities: [
      { value: 'Berlin, Germany', label: 'Berlin' },
      { value: 'Munich, Germany', label: 'Munich' },
      { value: 'Hamburg, Germany', label: 'Hamburg' },
    ],
  },
  {
    value: 'France',
    label: 'France',
    flag: '🇫🇷',
    cities: [
      { value: 'Paris, France', label: 'Paris' },
      { value: 'Lyon, France', label: 'Lyon' },
      { value: 'Marseille, France', label: 'Marseille' },
    ],
  },
  {
    value: 'Netherlands',
    label: 'Netherlands',
    flag: '🇳🇱',
    cities: [
      { value: 'Amsterdam, Netherlands', label: 'Amsterdam' },
      { value: 'Rotterdam, Netherlands', label: 'Rotterdam' },
    ],
  },
  {
    value: 'Spain',
    label: 'Spain',
    flag: '🇪🇸',
    cities: [
      { value: 'Barcelona, Spain', label: 'Barcelona' },
      { value: 'Madrid, Spain', label: 'Madrid' },
    ],
  },
  {
    value: 'Sweden',
    label: 'Sweden',
    flag: '🇸🇪',
    cities: [
      { value: 'Stockholm, Sweden', label: 'Stockholm' },
    ],
  },
  {
    value: 'Indonesia',
    label: 'Indonesia',
    flag: '🇮🇩',
    cities: [
      { value: 'Bali, Indonesia', label: 'Bali' },
      { value: 'Jakarta, Indonesia', label: 'Jakarta' },
    ],
  },
  {
    value: 'India',
    label: 'India',
    flag: '🇮🇳',
    cities: [
      { value: 'Mumbai, India', label: 'Mumbai' },
      { value: 'Delhi, India', label: 'Delhi' },
      { value: 'Bangalore, India', label: 'Bangalore' },
    ],
  },
  {
    value: 'Japan',
    label: 'Japan',
    flag: '🇯🇵',
    cities: [
      { value: 'Tokyo, Japan', label: 'Tokyo' },
      { value: 'Osaka, Japan', label: 'Osaka' },
    ],
  },
  {
    value: 'South Korea',
    label: 'South Korea',
    flag: '🇰🇷',
    cities: [
      { value: 'Seoul, South Korea', label: 'Seoul' },
    ],
  },
  {
    value: 'Australia',
    label: 'Australia',
    flag: '🇦🇺',
    cities: [
      { value: 'Sydney, Australia', label: 'Sydney' },
      { value: 'Melbourne, Australia', label: 'Melbourne' },
    ],
  },
  {
    value: 'United Arab Emirates',
    label: 'United Arab Emirates',
    flag: '🇦🇪',
    cities: [
      { value: 'Dubai, UAE', label: 'Dubai' },
      { value: 'Abu Dhabi, UAE', label: 'Abu Dhabi' },
      { value: 'Sharjah, UAE', label: 'Sharjah' },
    ],
  },
  {
    value: 'Saudi Arabia',
    label: 'Saudi Arabia',
    flag: '🇸🇦',
    cities: [
      { value: 'Riyadh, Saudi Arabia', label: 'Riyadh' },
      { value: 'Jeddah, Saudi Arabia', label: 'Jeddah' },
    ],
  },
  {
    value: 'Qatar',
    label: 'Qatar',
    flag: '🇶🇦',
    cities: [
      { value: 'Doha, Qatar', label: 'Doha' },
    ],
  },
  {
    value: 'Brazil',
    label: 'Brazil',
    flag: '🇧🇷',
    cities: [
      { value: 'São Paulo, Brazil', label: 'São Paulo' },
      { value: 'Rio de Janeiro, Brazil', label: 'Rio de Janeiro' },
    ],
  },
  {
    value: 'Mexico',
    label: 'Mexico',
    flag: '🇲🇽',
    cities: [
      { value: 'Mexico City, Mexico', label: 'Mexico City' },
    ],
  },
  {
    value: 'Colombia',
    label: 'Colombia',
    flag: '🇨🇴',
    cities: [
      { value: 'Medellín, Colombia', label: 'Medellín' },
      { value: 'Bogotá, Colombia', label: 'Bogotá' },
    ],
  },
  {
    value: 'Argentina',
    label: 'Argentina',
    flag: '🇦🇷',
    cities: [
      { value: 'Buenos Aires, Argentina', label: 'Buenos Aires' },
    ],
  },
  {
    value: 'South Africa',
    label: 'South Africa',
    flag: '🇿🇦',
    cities: [
      { value: 'Cape Town, South Africa', label: 'Cape Town' },
      { value: 'Johannesburg, South Africa', label: 'Johannesburg' },
    ],
  },
  {
    value: 'Ghana',
    label: 'Ghana',
    flag: '🇬🇭',
    cities: [
      { value: 'Accra, Ghana', label: 'Accra' },
    ],
  },
  {
    value: 'Kenya',
    label: 'Kenya',
    flag: '🇰🇪',
    cities: [
      { value: 'Nairobi, Kenya', label: 'Nairobi' },
    ],
  },
];

/**
 * Given a country value, returns all city values that belong to it.
 */
export function getCitiesForCountry(countryValue: string): string[] {
  const country = LOCATION_HIERARCHY.find(c => c.value === countryValue);
  if (!country) return [];
  return country.cities.map(c => c.value);
}

/**
 * Given a country value, returns all location strings that should match
 * (the country name itself + all cities).
 */
export function getMatchingLocations(filterValue: string): string[] {
  const country = LOCATION_HIERARCHY.find(c => c.value === filterValue);
  if (country) {
    return [country.value, ...country.cities.map(c => c.value)];
  }
  return [filterValue];
}

/**
 * Check if a profile's location matches the selected filter.
 * Handles country-level grouping and substring matching.
 */
export function locationMatchesFilter(
  profileLocation: string | null,
  filterCountry: string,
  filterCity?: string
): boolean {
  if (!profileLocation) return false;
  if (filterCountry === 'all') return true;

  const normalizedProfile = profileLocation.toLowerCase().trim();

  // If a specific city is selected, match against that city
  if (filterCity && filterCity !== 'all') {
    const normalizedCity = filterCity.toLowerCase().trim();
    if (normalizedProfile === normalizedCity) return true;
    if (normalizedProfile.includes(normalizedCity) || normalizedCity.includes(normalizedProfile)) return true;
    return false;
  }

  // Country-level: match against country name and all its cities
  const matchingLocations = getMatchingLocations(filterCountry);
  if (matchingLocations.some(loc => normalizedProfile === loc.toLowerCase())) return true;

  // Fuzzy: country name substring
  const normalizedFilter = filterCountry.toLowerCase().trim();
  if (normalizedProfile.includes(normalizedFilter) || normalizedFilter.includes(normalizedProfile)) return true;

  // Also check if profile mentions any word from country (e.g. "Trinidad" in "Port of Spain, Trinidad")
  const countryWords = normalizedFilter.split(/[\s&,]+/).filter(w => w.length > 2);
  if (countryWords.some(word => normalizedProfile.includes(word))) return true;

  return false;
}
