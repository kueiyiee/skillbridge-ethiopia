export type EthiopiaLocationType = 'region' | 'city-administration' | 'city' | 'town';

export interface EthiopiaLocation {
  id: string;
  name: string;
  type: EthiopiaLocationType;
  parentId?: string;
  aliases?: string[];
  legacyAliases?: string[];
  region?: string;
}

export const ETHIOPIA_REGIONS: EthiopiaLocation[] = [
  { id: 'addis-ababa', name: 'Addis Ababa City Administration', type: 'city-administration', aliases: ['Addis Ababa', 'Addis Abeba'] },
  { id: 'afar', name: 'Afar Region', type: 'region', aliases: ['Afar'] },
  { id: 'amhara', name: 'Amhara Region', type: 'region', aliases: ['Amhara'] },
  { id: 'benishangul-gumuz', name: 'Benishangul-Gumuz Region', type: 'region', aliases: ['Benishangul Gumuz', 'Benshangul-Gumuz', 'Asosa'] },
  { id: 'central-ethiopia', name: 'Central Ethiopia Regional State', type: 'region', aliases: ['Central Ethiopia'], legacyAliases: ['SNNPR', 'Southern Nations, Nationalities and Peoples Region'] },
  { id: 'dire-dawa', name: 'Dire Dawa City Administration', type: 'city-administration', aliases: ['Dire Dawa'] },
  { id: 'gambella', name: 'Gambella Region', type: 'region', aliases: ['Gambella', 'Nuer Regional State'] },
  { id: 'harari', name: 'Harari Region', type: 'region', aliases: ['Harar', 'Harari'] },
  { id: 'oromia', name: 'Oromia Region', type: 'region', aliases: ['Oromia'] },
  { id: 'sidama', name: 'Sidama Region', type: 'region', aliases: ['Sidama'], legacyAliases: ['SNNPR', 'Southern Nations, Nationalities and Peoples Region'] },
  { id: 'somali', name: 'Somali Region', type: 'region', aliases: ['Somali', 'Jijiga'] },
  { id: 'south-ethiopia', name: 'South Ethiopia Regional State', type: 'region', aliases: ['South Ethiopia'], legacyAliases: ['SNNPR', 'Southern Nations, Nationalities and Peoples Region'] },
  { id: 'south-west-ethiopia', name: 'South West Ethiopia Peoples\' Region', type: 'region', aliases: ['South West Ethiopia', 'Southwest Ethiopia'], legacyAliases: ['SNNPR', 'Southern Nations, Nationalities and Peoples Region'] },
  { id: 'tigray', name: 'Tigray Region', type: 'region', aliases: ['Tigray', 'Mekele', 'Mekelle'] },
];

export const ETHIOPIA_LOCATIONS: EthiopiaLocation[] = [
  ...ETHIOPIA_REGIONS,
  { id: 'hawassa', name: 'Hawassa', type: 'city', parentId: 'sidama', region: 'Sidama Region', aliases: ['Hawassa City'] },
  { id: 'adama', name: 'Adama', type: 'city', parentId: 'oromia', region: 'Oromia Region', aliases: ['Nazret', 'Adama City'] },
  { id: 'bahir-dar', name: 'Bahir Dar', type: 'city', parentId: 'amhara', region: 'Amhara Region', aliases: ['Bahir Dar City'] },
  { id: 'awash', name: 'Awash', type: 'town', parentId: 'afar', region: 'Afar Region', aliases: ['Awash Arba', 'Awash Town'] },
  { id: 'mekelle', name: 'Mekelle', type: 'city', parentId: 'tigray', region: 'Tigray Region', aliases: ['Mekele'] },
  { id: 'jijiga', name: 'Jijiga', type: 'city', parentId: 'somali', region: 'Somali Region', aliases: ['Jigjiga'] },
  { id: 'semera', name: 'Semera', type: 'city', parentId: 'afar', region: 'Afar Region', aliases: ['Semera Town'] },
  { id: 'gambella-city', name: 'Gambella', type: 'city', parentId: 'gambella', region: 'Gambella Region', aliases: ['Gambella Town'] },
  { id: 'harar', name: 'Harar', type: 'city', parentId: 'harari', region: 'Harari Region', aliases: ['Harer'] },
  { id: 'asosa', name: 'Asosa', type: 'city', parentId: 'benishangul-gumuz', region: 'Benishangul-Gumuz Region', aliases: ['Assosa'] },
  { id: 'wolaita-sodo', name: 'Wolaita Sodo', type: 'city', parentId: 'south-ethiopia', region: 'South Ethiopia Regional State', aliases: ['Wolayita Sodo'] },
  { id: 'hosaena', name: 'Hosaena', type: 'city', parentId: 'central-ethiopia', region: 'Central Ethiopia Regional State', aliases: ['Hosaina'] },
  { id: 'bonga', name: 'Bonga', type: 'town', parentId: 'south-west-ethiopia', region: 'South West Ethiopia Peoples\' Region', aliases: ['Bonga Town'] },
  { id: 'sodo', name: 'Sodo', type: 'town', parentId: 'south-ethiopia', region: 'South Ethiopia Regional State', aliases: ['Soddo', 'Wolaita Sodo'] },
  { id: 'dila', name: 'Dila', type: 'town', parentId: 'south-ethiopia', region: 'South Ethiopia Regional State', aliases: ['Dilla'] },
  { id: 'negele-borana', name: 'Negele Borana', type: 'town', parentId: 'oromia', region: 'Oromia Region', aliases: ['Negele'] },
  { id: 'shashamane', name: 'Shashamane', type: 'city', parentId: 'oromia', region: 'Oromia Region', aliases: ['Shashemene'] },
  { id: 'jimma', name: 'Jimma', type: 'city', parentId: 'oromia', region: 'Oromia Region', aliases: ['Jima'] },
  { id: 'bishoftu', name: 'Bishoftu', type: 'city', parentId: 'oromia', region: 'Oromia Region', aliases: ['Debre Zeit'] },
  { id: 'mekane-selam', name: 'Mekane Selam', type: 'town', parentId: 'south-west-ethiopia', region: 'South West Ethiopia Peoples\' Region', aliases: ['Mekane Selam Town'] },
  { id: 'arba-minch', name: 'Arba Minch', type: 'city', parentId: 'south-ethiopia', region: 'South Ethiopia Regional State', aliases: ['Arba Minch Town'] },
  { id: 'soddo', name: 'Soddo', type: 'town', parentId: 'south-ethiopia', region: 'South Ethiopia Regional State', aliases: ['Sodo'] },
  { id: 'mizan-teferi', name: 'Mizan Teferi', type: 'town', parentId: 'south-west-ethiopia', region: 'South West Ethiopia Peoples\' Region', aliases: ['Mizan-Tepi'] },
];

export const ETHIOPIA_LOCATION_MAP = new Map(ETHIOPIA_LOCATIONS.map((location) => [location.id, location]));

export function normalizeLocationKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function getLocationOptionByName(value: string): EthiopiaLocation | undefined {
  const normalized = normalizeLocationKey(value);
  if (!normalized || normalized === 'all') return undefined;

  return ETHIOPIA_LOCATIONS.find((location) => {
    const names = [location.name, ...(location.aliases ?? []), ...(location.legacyAliases ?? [])].map(normalizeLocationKey);
    return names.includes(normalized);
  });
}

export function getLocationMatchValues(value: string): string[] {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.toLowerCase() === 'all' || trimmed.toLowerCase() === 'all locations') return [];

  const location = getLocationOptionByName(trimmed);
  const matches = new Set<string>();

  const addValues = (...values: Array<string | undefined | null>) => {
    values.filter((entry): entry is string => Boolean(entry && entry.trim())).forEach((entry) => {
      const normalized = normalizeLocationKey(entry);
      if (normalized) matches.add(normalized);
    });
  };

  if (location) {
    addValues(location.name, ...(location.aliases ?? []), ...(location.legacyAliases ?? []));

    if (location.type === 'region' || location.type === 'city-administration') {
      ETHIOPIA_LOCATIONS.filter((item) => item.parentId === location.id || item.region === location.name).forEach((item) => {
        addValues(item.name, ...(item.aliases ?? []), ...(item.legacyAliases ?? []));
      });
    }

    if (location.region) {
      addValues(location.region);
    }

    if (
      location.name === 'Sidama Region'
      || location.name === 'South Ethiopia Regional State'
      || location.name === 'South West Ethiopia Peoples\' Region'
      || location.name === 'Central Ethiopia Regional State'
    ) {
      addValues('SNNPR', 'South Nations, Nationalities and Peoples Region', 'Southern Nations, Nationalities and Peoples Region');
    }
  }

  if (trimmed.toLowerCase() === 'snnpr' || trimmed.toLowerCase().includes('southern nations') || trimmed.toLowerCase().includes('south nations')) {
    addValues('sidama region', 'south ethiopia regional state', 'south west ethiopia peoples region', 'central ethiopia regional state');
  }

  addValues(trimmed);

  return [...matches];
}

export function getLocationOptions(query = ''): EthiopiaLocation[] {
  const normalized = normalizeLocationKey(query);
  const searchList = normalized
    ? ETHIOPIA_LOCATIONS.filter((location) => {
        const haystack = [location.name, ...(location.aliases ?? []), ...(location.legacyAliases ?? [])].join(' ').toLowerCase();
        return haystack.includes(normalized);
      })
    : ETHIOPIA_LOCATIONS;

  return searchList.slice(0, 18);
}
