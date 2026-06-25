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
    speedTestUrl: 'http://fsn1-speed.hetzner.com/100MB.bin',
  },
  {
    value: 'nbg1',
    code: 'NBG1',
    city: 'Nuremberg',
    country: 'Germany',
    zone: 'eu-central',
    speedTestUrl: 'http://nbg1-speed.hetzner.com/100MB.bin',
  },
  {
    value: 'hel1',
    code: 'HEL1',
    city: 'Helsinki',
    country: 'Finland',
    zone: 'eu-central',
    speedTestUrl: 'http://hel1-speed.hetzner.com/100MB.bin',
  },
  {
    value: 'ash',
    code: 'ASH',
    city: 'Ashburn, VA',
    country: 'United States',
    zone: 'us-east',
    speedTestUrl: 'http://ash-speed.hetzner.com/100MB.bin',
  },
  {
    value: 'hil',
    code: 'HIL',
    city: 'Hillsboro, OR',
    country: 'United States',
    zone: 'us-west',
    speedTestUrl: 'http://hil-speed.hetzner.com/100MB.bin',
  },
  {
    value: 'sin',
    code: 'SIN',
    city: 'Singapore',
    country: 'Singapore',
    zone: 'ap-southeast',
    speedTestUrl: 'http://sin-speed.hetzner.com/100MB.bin',
  },
];

export const defaultHetznerRegion = 'hel1';

export const getHetznerRegion = (value: string | number | boolean | string[] | null | undefined) =>
  hetznerRegions.find((region) => region.value === value?.toString());
