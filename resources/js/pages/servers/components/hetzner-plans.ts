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
  deprecated?: boolean;
};

export const hetznerPlans: HetznerPlan[] = [
  // Cost Optimized
  { value: 'cx23', name: 'CX23', label: 'CX23 - 2 vCPU, 4 GB RAM, 40 GB SSD - x86 shared, low cost', group: 'Cost Optimized', cpu: 2, ram: 4, disk: 40, architecture: 'x86 shared', monthlyEur: 5.49, hourlyEur: 0.0088 },
  { value: 'cx33', name: 'CX33', label: 'CX33 - 4 vCPU, 8 GB RAM, 80 GB SSD - x86 shared, low cost', group: 'Cost Optimized', cpu: 4, ram: 8, disk: 80, architecture: 'x86 shared', monthlyEur: 8.49, hourlyEur: 0.0136 },
  { value: 'cx43', name: 'CX43', label: 'CX43 - 8 vCPU, 16 GB RAM, 160 GB SSD - x86 shared, low cost', group: 'Cost Optimized', cpu: 8, ram: 16, disk: 160, architecture: 'x86 shared', monthlyEur: 15.99, hourlyEur: 0.0256 },
  { value: 'cx53', name: 'CX53', label: 'CX53 - 16 vCPU, 32 GB RAM, 320 GB SSD - x86 shared, low cost', group: 'Cost Optimized', cpu: 16, ram: 32, disk: 320, architecture: 'x86 shared', monthlyEur: 29.49, hourlyEur: 0.0473 },

  // Regular Performance
  { value: 'cpx22', name: 'CPX22', label: 'CPX22 - 2 vCPU, 4 GB RAM, 80 GB SSD - x86 shared, regular performance', group: 'Regular Performance', cpu: 2, ram: 4, disk: 80, architecture: 'x86 shared', monthlyEur: 19.49, hourlyEur: 0.0312 },
  { value: 'cpx32', name: 'CPX32', label: 'CPX32 - 4 vCPU, 8 GB RAM, 160 GB SSD - x86 shared, regular performance', group: 'Regular Performance', cpu: 4, ram: 8, disk: 160, architecture: 'x86 shared', monthlyEur: 35.49, hourlyEur: 0.0569 },
  { value: 'cpx42', name: 'CPX42', label: 'CPX42 - 8 vCPU, 16 GB RAM, 320 GB SSD - x86 shared, regular performance', group: 'Regular Performance', cpu: 8, ram: 16, disk: 320, architecture: 'x86 shared', monthlyEur: 69.49, hourlyEur: 0.1114 },
  { value: 'cpx52', name: 'CPX52', label: 'CPX52 - 12 vCPU, 24 GB RAM, 480 GB SSD - x86 shared, regular performance', group: 'Regular Performance', cpu: 12, ram: 24, disk: 480, architecture: 'x86 shared', monthlyEur: 100.49, hourlyEur: 0.161 },
  { value: 'cpx62', name: 'CPX62', label: 'CPX62 - 16 vCPU, 32 GB RAM, 640 GB SSD - x86 shared, regular performance', group: 'Regular Performance', cpu: 16, ram: 32, disk: 640, architecture: 'x86 shared', monthlyEur: 129.99, hourlyEur: 0.2083 },

  // ARM Shared
  { value: 'cax11', name: 'CAX11', label: 'CAX11 - 2 vCPU, 4 GB RAM, 40 GB SSD - ARM shared', group: 'ARM Shared', cpu: 2, ram: 4, disk: 40, architecture: 'ARM shared', monthlyEur: 5.99, hourlyEur: 0.0096 },
  { value: 'cax21', name: 'CAX21', label: 'CAX21 - 4 vCPU, 8 GB RAM, 80 GB SSD - ARM shared', group: 'ARM Shared', cpu: 4, ram: 8, disk: 80, architecture: 'ARM shared', monthlyEur: 10.49, hourlyEur: 0.0168 },
  { value: 'cax31', name: 'CAX31', label: 'CAX31 - 8 vCPU, 16 GB RAM, 160 GB SSD - ARM shared', group: 'ARM Shared', cpu: 8, ram: 16, disk: 160, architecture: 'ARM shared', monthlyEur: 20.99, hourlyEur: 0.0336 },
  { value: 'cax41', name: 'CAX41', label: 'CAX41 - 16 vCPU, 32 GB RAM, 320 GB SSD - ARM shared', group: 'ARM Shared', cpu: 16, ram: 32, disk: 320, architecture: 'ARM shared', monthlyEur: 40.99, hourlyEur: 0.0657 },

  // Dedicated vCPU
  { value: 'ccx13', name: 'CCX13', label: 'CCX13 - 2 dedicated vCPU, 8 GB RAM, 80 GB SSD - production', group: 'Dedicated vCPU', cpu: 2, ram: 8, disk: 80, architecture: 'AMD dedicated', monthlyEur: 42.99, hourlyEur: 0.0689 },
  { value: 'ccx23', name: 'CCX23', label: 'CCX23 - 4 dedicated vCPU, 16 GB RAM, 160 GB SSD - production', group: 'Dedicated vCPU', cpu: 4, ram: 16, disk: 160, architecture: 'AMD dedicated', monthlyEur: 85.99, hourlyEur: 0.1378 },
  { value: 'ccx33', name: 'CCX33', label: 'CCX33 - 8 dedicated vCPU, 32 GB RAM, 240 GB SSD - production', group: 'Dedicated vCPU', cpu: 8, ram: 32, disk: 240, architecture: 'AMD dedicated', monthlyEur: 138.49, hourlyEur: 0.2219 },
  { value: 'ccx43', name: 'CCX43', label: 'CCX43 - 16 dedicated vCPU, 64 GB RAM, 360 GB SSD - production', group: 'Dedicated vCPU', cpu: 16, ram: 64, disk: 360, architecture: 'AMD dedicated', monthlyEur: 275.99, hourlyEur: 0.4423 },
  { value: 'ccx53', name: 'CCX53', label: 'CCX53 - 32 dedicated vCPU, 128 GB RAM, 600 GB SSD - production', group: 'Dedicated vCPU', cpu: 32, ram: 128, disk: 600, architecture: 'AMD dedicated', monthlyEur: 533.49, hourlyEur: 0.855 },
  { value: 'ccx63', name: 'CCX63', label: 'CCX63 - 48 dedicated vCPU, 192 GB RAM, 960 GB SSD - production', group: 'Dedicated vCPU', cpu: 48, ram: 192, disk: 960, architecture: 'AMD dedicated', monthlyEur: 853.49, hourlyEur: 1.3678 },

  // Deprecated (Previous Generation)
  { value: 'cx11', name: 'CX11', label: 'CX11 - 1 vCPU, 2 GB RAM, 20 GB SSD - x86 shared (Deprecated)', group: 'Deprecated (Previous Gen)', cpu: 1, ram: 2, disk: 20, architecture: 'x86 shared', monthlyEur: 3.49, hourlyEur: 0.0056, deprecated: true },
  { value: 'cx21', name: 'CX21', label: 'CX21 - 2 vCPU, 4 GB RAM, 40 GB SSD - x86 shared (Deprecated)', group: 'Deprecated (Previous Gen)', cpu: 2, ram: 4, disk: 40, architecture: 'x86 shared', monthlyEur: 5.35, hourlyEur: 0.0086, deprecated: true },
  { value: 'cx31', name: 'CX31', label: 'CX31 - 2 vCPU, 8 GB RAM, 80 GB SSD - x86 shared (Deprecated)', group: 'Deprecated (Previous Gen)', cpu: 2, ram: 8, disk: 80, architecture: 'x86 shared', monthlyEur: 9.99, hourlyEur: 0.016, deprecated: true },
  { value: 'cx41', name: 'CX41', label: 'CX41 - 4 vCPU, 16 GB RAM, 160 GB SSD - x86 shared (Deprecated)', group: 'Deprecated (Previous Gen)', cpu: 4, ram: 16, disk: 160, architecture: 'x86 shared', monthlyEur: 17.49, hourlyEur: 0.028, deprecated: true },
  { value: 'cx51', name: 'CX51', label: 'CX51 - 8 vCPU, 32 GB RAM, 240 GB SSD - x86 shared (Deprecated)', group: 'Deprecated (Previous Gen)', cpu: 8, ram: 32, disk: 240, architecture: 'x86 shared', monthlyEur: 32.49, hourlyEur: 0.052, deprecated: true },
  { value: 'cpx11', name: 'CPX11', label: 'CPX11 - 2 vCPU, 2 GB RAM, 40 GB SSD - x86 shared (Deprecated)', group: 'Deprecated (Previous Gen)', cpu: 2, ram: 2, disk: 40, architecture: 'x86 shared', monthlyEur: 4.49, hourlyEur: 0.0072, deprecated: true },
  { value: 'cpx21', name: 'CPX21', label: 'CPX21 - 3 vCPU, 4 GB RAM, 80 GB SSD - x86 shared (Deprecated)', group: 'Deprecated (Previous Gen)', cpu: 3, ram: 4, disk: 80, architecture: 'x86 shared', monthlyEur: 8.49, hourlyEur: 0.0136, deprecated: true },
  { value: 'cpx31', name: 'CPX31', label: 'CPX31 - 4 vCPU, 8 GB RAM, 160 GB SSD - x86 shared (Deprecated)', group: 'Deprecated (Previous Gen)', cpu: 4, ram: 8, disk: 160, architecture: 'x86 shared', monthlyEur: 14.99, hourlyEur: 0.024, deprecated: true },
  { value: 'cpx41', name: 'CPX41', label: 'CPX41 - 8 vCPU, 16 GB RAM, 240 GB SSD - x86 shared (Deprecated)', group: 'Deprecated (Previous Gen)', cpu: 8, ram: 16, disk: 240, architecture: 'x86 shared', monthlyEur: 28.49, hourlyEur: 0.0456, deprecated: true },
  { value: 'cpx51', name: 'CPX51', label: 'CPX51 - 16 vCPU, 32 GB RAM, 360 GB SSD - x86 shared (Deprecated)', group: 'Deprecated (Previous Gen)', cpu: 16, ram: 32, disk: 360, architecture: 'x86 shared', monthlyEur: 57.49, hourlyEur: 0.092, deprecated: true },
  { value: 'ccx12', name: 'CCX12', label: 'CCX12 - 2 dedicated vCPU, 8 GB RAM, 80 GB SSD - AMD dedicated (Deprecated)', group: 'Deprecated (Previous Gen)', cpu: 2, ram: 8, disk: 80, architecture: 'AMD dedicated', monthlyEur: 37.99, hourlyEur: 0.0608, deprecated: true },
  { value: 'ccx22', name: 'CCX22', label: 'CCX22 - 4 dedicated vCPU, 16 GB RAM, 160 GB SSD - AMD dedicated (Deprecated)', group: 'Deprecated (Previous Gen)', cpu: 4, ram: 16, disk: 160, architecture: 'AMD dedicated', monthlyEur: 75.99, hourlyEur: 0.1216, deprecated: true },
  { value: 'ccx32', name: 'CCX32', label: 'CCX32 - 8 dedicated vCPU, 32 GB RAM, 240 GB SSD - AMD dedicated (Deprecated)', group: 'Deprecated (Previous Gen)', cpu: 8, ram: 32, disk: 240, architecture: 'AMD dedicated', monthlyEur: 122.99, hourlyEur: 0.1968, deprecated: true },
  { value: 'ccx42', name: 'CCX42', label: 'CCX42 - 16 dedicated vCPU, 64 GB RAM, 360 GB SSD - AMD dedicated (Deprecated)', group: 'Deprecated (Previous Gen)', cpu: 16, ram: 64, disk: 360, architecture: 'AMD dedicated', monthlyEur: 245.99, hourlyEur: 0.3936, deprecated: true },
  { value: 'ccx52', name: 'CCX52', label: 'CCX52 - 32 dedicated vCPU, 128 GB RAM, 600 GB SSD - AMD dedicated (Deprecated)', group: 'Deprecated (Previous Gen)', cpu: 32, ram: 128, disk: 600, architecture: 'AMD dedicated', monthlyEur: 475.99, hourlyEur: 0.7616, deprecated: true },
  { value: 'ccx62', name: 'CCX62', label: 'CCX62 - 48 dedicated vCPU, 192 GB RAM, 960 GB SSD - AMD dedicated (Deprecated)', group: 'Deprecated (Previous Gen)', cpu: 48, ram: 192, disk: 960, architecture: 'AMD dedicated', monthlyEur: 760.99, hourlyEur: 1.2176, deprecated: true },
];

export const defaultHetznerPlan = 'cx33';

export const getHetznerPlan = (value: string | number | boolean | string[] | null | undefined) =>
  hetznerPlans.find((plan) => plan.value === value?.toString());
