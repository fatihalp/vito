export type HetznerRegion = {
  value: string;
  code: string;
  city: string;
  country: string;
  zone: string;
  speedTestUrl: string;
};

export const hetznerRegions: HetznerRegion[] = [
  {
    value: 'fsn1',
    code: 'FSN1',
    city: 'Falkenstein',
    country: 'Germany',
    zone: 'eu-central',
    speedTestUrl: 'https://fsn1-speed.hetzner.com/',
  },
  {
    value: 'nbg1',
    code: 'NBG1',
    city: 'Nuremberg',
    country: 'Germany',
    zone: 'eu-central',
    speedTestUrl: 'https://nbg1-speed.hetzner.com/',
  },
  {
    value: 'hel1',
    code: 'HEL1',
    city: 'Helsinki',
    country: 'Finland',
    zone: 'eu-central',
    speedTestUrl: 'https://hel1-speed.hetzner.com/',
  },
  {
    value: 'ash',
    code: 'ASH',
    city: 'Ashburn, VA',
    country: 'United States',
    zone: 'us-east',
    speedTestUrl: 'https://ash-speed.hetzner.com/',
  },
  {
    value: 'hil',
    code: 'HIL',
    city: 'Hillsboro, OR',
    country: 'United States',
    zone: 'us-west',
    speedTestUrl: 'https://hil-speed.hetzner.com/',
  },
  {
    value: 'sin',
    code: 'SIN',
    city: 'Singapore',
    country: 'Singapore',
    zone: 'ap-southeast',
    speedTestUrl: 'https://sin-speed.hetzner.com/',
  },
];

export const defaultHetznerRegion = 'hel1';

export const getHetznerRegion = (value: string | number | boolean | string[] | null | undefined) =>
  hetznerRegions.find((region) => region.value === value?.toString());
