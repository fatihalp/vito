export type HetznerPlan = {
  value: string;
  name: string;
  label: string;
  group: string;
  cpu: number;
  ram: number;
  disk: number;
  architecture: string;
  monthlyEur: number;
  hourlyEur: number;
};

export const hetznerPlans: HetznerPlan[] = [
  { value: 'cx23', name: 'CX23', label: 'CX23 - 2 vCPU, 4 GB RAM, 40 GB SSD - x86 shared, low cost', group: 'Cost Optimized', cpu: 2, ram: 4, disk: 40, architecture: 'x86 shared', monthlyEur: 5.49, hourlyEur: 0.0088 },
  { value: 'cx33', name: 'CX33', label: 'CX33 - 4 vCPU, 8 GB RAM, 80 GB SSD - x86 shared, low cost', group: 'Cost Optimized', cpu: 4, ram: 8, disk: 80, architecture: 'x86 shared', monthlyEur: 8.49, hourlyEur: 0.0136 },
  { value: 'cx43', name: 'CX43', label: 'CX43 - 8 vCPU, 16 GB RAM, 160 GB SSD - x86 shared, low cost', group: 'Cost Optimized', cpu: 8, ram: 16, disk: 160, architecture: 'x86 shared', monthlyEur: 15.99, hourlyEur: 0.0256 },
  { value: 'cx53', name: 'CX53', label: 'CX53 - 16 vCPU, 32 GB RAM, 320 GB SSD - x86 shared, low cost', group: 'Cost Optimized', cpu: 16, ram: 32, disk: 320, architecture: 'x86 shared', monthlyEur: 29.49, hourlyEur: 0.0473 },
  { value: 'cpx22', name: 'CPX22', label: 'CPX22 - 2 vCPU, 4 GB RAM, 80 GB SSD - x86 shared, regular performance', group: 'Regular Performance', cpu: 2, ram: 4, disk: 80, architecture: 'x86 shared', monthlyEur: 19.49, hourlyEur: 0.0312 },
  { value: 'cpx32', name: 'CPX32', label: 'CPX32 - 4 vCPU, 8 GB RAM, 160 GB SSD - x86 shared, regular performance', group: 'Regular Performance', cpu: 4, ram: 8, disk: 160, architecture: 'x86 shared', monthlyEur: 35.49, hourlyEur: 0.0569 },
  { value: 'cpx42', name: 'CPX42', label: 'CPX42 - 8 vCPU, 16 GB RAM, 320 GB SSD - x86 shared, regular performance', group: 'Regular Performance', cpu: 8, ram: 16, disk: 320, architecture: 'x86 shared', monthlyEur: 69.49, hourlyEur: 0.1114 },
  { value: 'cpx52', name: 'CPX52', label: 'CPX52 - 12 vCPU, 24 GB RAM, 480 GB SSD - x86 shared, regular performance', group: 'Regular Performance', cpu: 12, ram: 24, disk: 480, architecture: 'x86 shared', monthlyEur: 100.49, hourlyEur: 0.161 },
  { value: 'cpx62', name: 'CPX62', label: 'CPX62 - 16 vCPU, 32 GB RAM, 640 GB SSD - x86 shared, regular performance', group: 'Regular Performance', cpu: 16, ram: 32, disk: 640, architecture: 'x86 shared', monthlyEur: 129.99, hourlyEur: 0.2083 },
  { value: 'cax11', name: 'CAX11', label: 'CAX11 - 2 vCPU, 4 GB RAM, 40 GB SSD - ARM shared', group: 'ARM Shared', cpu: 2, ram: 4, disk: 40, architecture: 'ARM shared', monthlyEur: 5.99, hourlyEur: 0.0096 },
  { value: 'cax21', name: 'CAX21', label: 'CAX21 - 4 vCPU, 8 GB RAM, 80 GB SSD - ARM shared', group: 'ARM Shared', cpu: 4, ram: 8, disk: 80, architecture: 'ARM shared', monthlyEur: 10.49, hourlyEur: 0.0168 },
  { value: 'cax31', name: 'CAX31', label: 'CAX31 - 8 vCPU, 16 GB RAM, 160 GB SSD - ARM shared', group: 'ARM Shared', cpu: 8, ram: 16, disk: 160, architecture: 'ARM shared', monthlyEur: 20.99, hourlyEur: 0.0336 },
  { value: 'cax41', name: 'CAX41', label: 'CAX41 - 16 vCPU, 32 GB RAM, 320 GB SSD - ARM shared', group: 'ARM Shared', cpu: 16, ram: 32, disk: 320, architecture: 'ARM shared', monthlyEur: 40.99, hourlyEur: 0.0657 },
  { value: 'ccx13', name: 'CCX13', label: 'CCX13 - 2 dedicated vCPU, 8 GB RAM, 80 GB SSD - production', group: 'Dedicated vCPU', cpu: 2, ram: 8, disk: 80, architecture: 'AMD dedicated', monthlyEur: 42.99, hourlyEur: 0.0689 },
  { value: 'ccx23', name: 'CCX23', label: 'CCX23 - 4 dedicated vCPU, 16 GB RAM, 160 GB SSD - production', group: 'Dedicated vCPU', cpu: 4, ram: 16, disk: 160, architecture: 'AMD dedicated', monthlyEur: 85.99, hourlyEur: 0.1378 },
  { value: 'ccx33', name: 'CCX33', label: 'CCX33 - 8 dedicated vCPU, 32 GB RAM, 240 GB SSD - production', group: 'Dedicated vCPU', cpu: 8, ram: 32, disk: 240, architecture: 'AMD dedicated', monthlyEur: 138.49, hourlyEur: 0.2219 },
  { value: 'ccx43', name: 'CCX43', label: 'CCX43 - 16 dedicated vCPU, 64 GB RAM, 360 GB SSD - production', group: 'Dedicated vCPU', cpu: 16, ram: 64, disk: 360, architecture: 'AMD dedicated', monthlyEur: 275.99, hourlyEur: 0.4423 },
  { value: 'ccx53', name: 'CCX53', label: 'CCX53 - 32 dedicated vCPU, 128 GB RAM, 600 GB SSD - production', group: 'Dedicated vCPU', cpu: 32, ram: 128, disk: 600, architecture: 'AMD dedicated', monthlyEur: 533.49, hourlyEur: 0.855 },
  { value: 'ccx63', name: 'CCX63', label: 'CCX63 - 48 dedicated vCPU, 192 GB RAM, 960 GB SSD - production', group: 'Dedicated vCPU', cpu: 48, ram: 192, disk: 960, architecture: 'AMD dedicated', monthlyEur: 853.49, hourlyEur: 1.3678 },
];

export const defaultHetznerPlan = 'cx33';

export const getHetznerPlan = (value: string | number | boolean | string[] | null | undefined) =>
  hetznerPlans.find((plan) => plan.value === value?.toString());
