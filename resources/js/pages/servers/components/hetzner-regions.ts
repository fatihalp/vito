import axios from 'axios';

export type HetznerRegion = {
  value: string;
  code: string;
  city: string;
  country: string;
  zone: string;
  speedtestHost: string;
};

export const hetznerRegions: HetznerRegion[] = [
  { value: 'fsn1', code: 'FSN1', city: 'Falkenstein', country: 'Germany', zone: 'eu-central', speedtestHost: 'fsn1-speed.hetzner.com' },
  { value: 'nbg1', code: 'NBG1', city: 'Nuremberg', country: 'Germany', zone: 'eu-central', speedtestHost: 'nbg1-speed.hetzner.com' },
  { value: 'hel1', code: 'HEL1', city: 'Helsinki', country: 'Finland', zone: 'eu-central', speedtestHost: 'hel1-speed.hetzner.com' },
  { value: 'ash', code: 'ASH', city: 'Ashburn', country: 'United States', zone: 'us-east', speedtestHost: 'ash-speed.hetzner.com' },
  { value: 'hil', code: 'HIL', city: 'Hillsboro', country: 'United States', zone: 'us-west', speedtestHost: 'hil-speed.hetzner.com' },
  { value: 'sin', code: 'SIN', city: 'Singapore', country: 'Singapore', zone: 'ap-southeast', speedtestHost: 'sin-speed.hetzner.com' },
];

export const getHetznerRegion = (value: string | number | boolean | string[] | null | undefined) =>
  hetznerRegions.find((region) => region.value === value?.toString());

export type Latencies = Record<string, number | null>;

let memoryLatenciesCache: Latencies | null = null;
let latencyPromise: Promise<Latencies> | null = null;

export const getCachedLatencies = (): Latencies | null => {
  if (memoryLatenciesCache) return memoryLatenciesCache;
  try {
    const raw = sessionStorage.getItem('vito.hetzner_latencies');
    if (raw) {
      memoryLatenciesCache = JSON.parse(raw);
      return memoryLatenciesCache;
    }
  } catch {
  }
  return null;
};

export const setCachedLatencies = (latencies: Latencies): void => {
  memoryLatenciesCache = latencies;
  try {
    sessionStorage.setItem('vito.hetzner_latencies', JSON.stringify(latencies));
  } catch {
  }
};

export const fetchHetznerLatencies = async (force = false): Promise<Latencies> => {
  if (!force) {
    const cached = getCachedLatencies();
    if (cached && Object.keys(cached).length > 0) {
      return cached;
    }
  }

  if (latencyPromise && !force) {
    return latencyPromise;
  }

  latencyPromise = (async () => {
    try {
      const response = await axios.get<{ latencies: Latencies }>(route('hetzner.latency'));
      const data = response.data.latencies;
      setCachedLatencies(data);
      return data;
    } finally {
      latencyPromise = null;
    }
  })();

  return latencyPromise;
};
