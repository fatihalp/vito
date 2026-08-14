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
