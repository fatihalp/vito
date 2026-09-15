import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronsUpDownIcon,
  ClipboardCheckIcon,
  ClipboardIcon,
  LoaderCircle,
  PlusIcon,
  TrashIcon,
  TriangleAlert,
  WifiIcon,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useForm } from '@inertiajs/react';
import React, { FormEventHandler, useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InputError from '@/components/ui/input-error';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ServerProvider } from '@/types/server-provider';
import ConnectServerProvider from '@/pages/server-providers/components/connect-server-provider';
import axios from 'axios';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { DataTable } from '@/components/data-table';
import { useConfigs, usePublicKeyText } from '@/stores/bootstrap-store';
import { ColumnDef } from '@tanstack/react-table';
import { EventBus } from '@/lib/event-bus';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import ServerTemplates from './templates';
import { ServerTemplate, Service } from '@/types/server-template';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import HetznerRegionSelect from './hetzner-region-select';
import { fetchHetznerLatencies } from './hetzner-regions';
import HetznerPlanSelect from './hetzner-plan-select';
import { toast } from 'sonner';
import { useSocketListener } from '@/hooks/use-socket-events';
import type { ServerRole } from '@/lib/server-roles';

const STEPS = [
  { id: 'provider', label: 'Provider' },
  { id: 'details', label: 'Server Details' },
  { id: 'services', label: 'Services' },
];

type PlanOption = {
  label: string;
  available: boolean;
};

const normalizePlan = (plan: string | PlanOption): PlanOption => (typeof plan === 'string' ? { label: plan, available: true } : plan);

const randomSuffix = (length = 4): string => Math.random().toString(36).slice(2, 2 + length);

const generateServerName = (role: string, stage: string, region: string): string =>
  [role, region, stage, randomSuffix()].filter(Boolean).join('-');

type CreateServerForm = {
  role: ServerRole;
  provider: string;
  server_provider: number;
  name: string;
  os: string;
  ip: string;
  port: number;
  region: string;
  plan: string;
  services: Service[];
  stage: 'prod' | 'beta' | 'alfa';
};

const baseServices: Service[] = [
  { type: 'monitoring', name: 'remote-monitor', version: 'latest' },
];

const servicesForRole = (role: CreateServerForm['role']): Service[] => {
  const roleServices: Record<CreateServerForm['role'], Service[]> = {
    app: [
      { type: 'webserver', name: 'nginx', version: 'latest' },
      { type: 'php', name: 'php', version: '8.5' },
      { type: 'process_manager', name: 'supervisor', version: 'latest' },
    ],
    queue: [
      { type: 'php', name: 'php', version: '8.5' },
      { type: 'process_manager', name: 'supervisor', version: 'latest' },
    ],
    database: [{ type: 'database', name: 'postgresql', version: '18' }],
    cache: [{ type: 'memory_database', name: 'redis', version: 'latest' }],
    custom: [],
  };

  return [...roleServices[role], ...baseServices];
};

function AddService() {
  const [open, setOpen] = useState(false);
  const configs = useConfigs()!;
  const form = useForm<Service>({
    type: '',
    name: '',
    version: '',
  });

  const add = () => {
    if (!form.data.name) {
      form.setError('name', 'Please select a service name');
      return;
    }

    if (!form.data.version) {
      form.setError('version', 'Please select a service version');
      return;
    }

    EventBus.emit('add-service', form.data);
    setOpen(false);
  };

  return (
    <Dialog modal open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="flex items-center justify-end p-0">
          <button type="button" className="cursor-pointer">
            <PlusIcon className="size-4" />
          </button>
        </div>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add service</DialogTitle>
          <DialogDescription className="sr-only">Add a new service to server installation</DialogDescription>
        </DialogHeader>

        <Form id="add-service-form" onSubmit={add} className="p-4">
          <FormFields>
            {}
            <FormField>
              <Label htmlFor="name">Name</Label>
              <Select
                value={form.data.name}
                onValueChange={(value) => {
                  form.setData('name', value);
                  form.setData('type', configs.service.services[value].type);
                  form.setData('version', '');
                }}
              >
                <SelectTrigger id="name">
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Object.entries(configs.service.services).map(([key, service]) => (
                      <SelectItem key={`service-${key}`} value={key}>
                        {service.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <InputError message={form.errors.type || form.errors.name} />
            </FormField>

            {}
            <FormField>
              <Label htmlFor="version">Version</Label>
              <Select value={form.data.version} onValueChange={(value) => form.setData('version', value)}>
                <SelectTrigger id="version">
                  <SelectValue placeholder="Select a version" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {form.data.name &&
                      configs.service.services[form.data.name].versions.map((version) => (
                        <SelectItem key={`version-${form.data.name}-${version}`} value={version}>
                          {version}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <InputError message={form.errors.version} />
            </FormField>
          </FormFields>
        </Form>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button form="add-service-form" type="button" onClick={add}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const servicesColumns: ColumnDef<Service>[] = [
  {
    accessorKey: 'type',
    header: 'Type',
  },
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'version',
    header: 'Version',
  },
  {
    id: 'actions',
    header: () => <AddService />,
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex items-center justify-end">
        <button type="button" className="hover:text-destructive" onClick={() => EventBus.emit('remove-service', row.original)}>
          <TrashIcon className="size-4" />
        </button>
      </div>
    ),
  },
];

export default function CreateServer({
  defaultOpen,
  onOpenChange,
  children,
}: {
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const configs = useConfigs()!;
  const publicKeyText = usePublicKeyText();

  const [open, setOpen] = useState(defaultOpen || false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (defaultOpen) {
      setOpen(defaultOpen);
    }

    const handleRemoveService = (d: unknown) => {
      const service = d as Service;
      form.setData((data) => ({
        ...data,
        services: data.services.filter((s) => s.type !== service.type || s.name !== service.name || s.version !== service.version),
      }));
    };
    EventBus.on('remove-service', handleRemoveService);

    const handleAddService = (d: unknown) => {
      const service = d as Service;
      form.setData((data) => ({
        ...data,
        services: [...data.services, service],
      }));
    };
    EventBus.on('add-service', handleAddService);

    return () => {
      EventBus.off('remove-service', handleRemoveService);
      EventBus.off('add-service', handleAddService);
    };
  }, [defaultOpen]);

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (onOpenChange) {
      onOpenChange(open);
    }
  };

  const form = useForm<Required<CreateServerForm>>({
    role: 'app',
    provider: 'custom',
    server_provider: 0,
    name: '',
    os: 'ubuntu_24',
    ip: '',
    port: 22,
    region: '',
    plan: '',
    services: servicesForRole('app'),
    stage: 'prod',
  });

  const [nameEdited, setNameEdited] = useState(false);
  useEffect(() => {
    if (nameEdited) {
      return;
    }
    if (form.data.provider === 'existing') {
      form.setData('name', `existing-${form.data.stage}-${randomSuffix()}`);
      return;
    }
    form.setData('name', generateServerName(form.data.role, form.data.stage, form.data.region));
  }, [form.data.role, form.data.stage, form.data.region, form.data.provider, nameEdited]);

  const [copySuccess, setCopySuccess] = useState(false);
  const copyToClipboard = () => {
    navigator.clipboard.writeText(publicKeyText).then(
      () => {
        setCopySuccess(true);
        setTimeout(() => {
          setCopySuccess(false);
        }, 2000);
      },
      () => {
        toast.error('Failed to copy to clipboard');
      },
    );
  };

  const [serverProviders, setServerProviders] = useState<ServerProvider[]>([]);
  const fetchServerProviders = async () => {
    const response = await axios.get<ServerProvider[]>(route('server-providers.json'));
    const providers = response.data;
    setServerProviders(providers);

    
    const hetznerConnection = providers.find((p) => p.provider === 'hetzner');
    if (hetznerConnection && form.data.provider === 'custom') {
      selectCombinedProvider(hetznerConnection.id.toString(), providers);
    }
  };

  useEffect(() => {
    if (open) {
      setStep(0);
      fetchServerProviders();
    }
  }, [open]);

  useEffect(() => {
    const errorKeys = Object.keys(form.errors);
    if (errorKeys.length === 0) return;

    if (errorKeys.some((k) => ['provider', 'server_provider', 'region', 'plan', 'ip', 'port'].includes(k))) {
      setStep(0);
    } else if (errorKeys.some((k) => ['name', 'os', 'role', 'stage'].includes(k))) {
      setStep(1);
    } else if (errorKeys.some((k) => k.startsWith('services'))) {
      setStep(2);
    }
  }, [form.errors]);

  useSocketListener((event) => {
    if (event.type?.startsWith('server-provider.')) {
      fetchServerProviders();
    }
  });

  const isExisting = form.data.provider === 'existing';
  const isCustom = form.data.provider === 'custom';
  const isDirectSsh = isCustom || isExisting;

  const canGoNextFromStep0 = () => {
    if (isDirectSsh) {
      if (!form.data.ip.trim()) {
        form.setError('ip', 'IP address is required');
        return false;
      }
      if (!form.data.port || form.data.port < 1 || form.data.port > 65535) {
        form.setError('port', 'Valid port (1-65535) is required');
        return false;
      }
      return true;
    }

    if (!form.data.server_provider || form.data.server_provider === 0) {
      form.setError('provider', 'Please select a provider account');
      return false;
    }
    if (!form.data.region) {
      form.setError('region', 'Please select a region');
      return false;
    }
    if (!form.data.plan) {
      form.setError('plan', 'Please select a plan');
      return false;
    }
    return true;
  };

  const canGoNextFromStep1 = () => {
    if (!form.data.name.trim()) {
      form.setError('name', 'Server name is required');
      return false;
    }
    if (!form.data.os) {
      form.setError('os', 'Operating system is required');
      return false;
    }
    return true;
  };

  const submit: FormEventHandler = (e) => {
    e.preventDefault();
    if (step !== 2) {
      form.clearErrors();
      if (step === 0 && !canGoNextFromStep0()) return;
      if (step === 1 && !canGoNextFromStep1()) return;
      setStep((s) => s + 1);
      return;
    }
    form.post(route('servers'));
  };

  const providerValue =
    form.data.provider === 'custom'
      ? 'custom'
      : form.data.provider === 'existing'
        ? 'existing'
        : form.data.server_provider
          ? form.data.server_provider.toString()
          : '';

  const selectCombinedProvider = async (value: string, providersList = serverProviders) => {
    form.clearErrors();
    form.setData('region', '');
    form.setData('plan', '');
    setRegions({});
    setPlans({});

    if (value === 'custom') {
      form.setData('provider', 'custom');
      form.setData('server_provider', 0);
      return;
    }

    if (value === 'existing') {
      form.setData('provider', 'existing');
      form.setData('server_provider', 0);
      form.setData('role', 'custom');
      form.setData('services', baseServices);
      return;
    }

    const connection = providersList.find((item) => item.id.toString() === value);
    if (!connection) {
      return;
    }

    form.setData('provider', connection.provider);
    form.setData('server_provider', connection.id);
    await fetchRegions(connection.id, connection.provider);
  };

  const [regionOpen, setRegionOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  const [regionLoading, setRegionLoading] = useState(false);
  const [regions, setRegions] = useState<{ [key: string]: string }>({});
  const fetchRegions = async (serverProvider: number, providerName?: string) => {
    setRegionLoading(true);
    try {
      const regionsRes = await axios.get(route('server-providers.regions', { serverProvider: serverProvider }));
      setRegions(regionsRes.data);

      if (providerName === 'hetzner' || form.data.provider === 'hetzner') {
        try {
          const latencies = await fetchHetznerLatencies();
          const validLatencies = Object.entries(latencies).filter((e): e is [string, number] => typeof e[1] === 'number');
          if (validLatencies.length > 0) {
            validLatencies.sort((a, b) => a[1] - b[1]);
            const bestRegion = validLatencies[0][0];
            if (regionsRes.data[bestRegion]) {
              await selectRegion(bestRegion, serverProvider);
            }
          }
        } catch {
          void 0;
        }
      }
    } finally {
      setRegionLoading(false);
    }
  };

  const selectRegion = async (region: string, providerId = form.data.server_provider) => {
    form.setData('region', region);
    if (region !== '' && providerId > 0) {
      await fetchPlans(providerId, region);
    }
  };

  const [plans, setPlans] = useState<{ [key: string]: string | PlanOption }>({});
  const fetchPlans = async (serverProvider: number, region: string) => {
    const plans = await axios.get(route('server-providers.plans', { serverProvider: serverProvider, region: region }));
    setPlans(plans.data);
  };
  const selectPlan = (plan: string) => {
    form.setData('plan', plan);
  };

  const serverTemplateChanged = (template: ServerTemplate | null) => {
    if (template) {
      form.setData('services', template.services);
    } else {
      form.setData('services', []);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange} modal>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="flex w-full flex-col justify-between lg:max-w-3xl">
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle>
                {isExisting ? 'Connect existing server' : 'Create new server'}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {step === 0 && (isExisting ? 'Connect your server via SSH' : 'Choose where to host your server')}
                {step === 1 && 'Configure server name, role, and operating system'}
                {step === 2 && 'Review services and launch your server'}
              </SheetDescription>
            </div>
            <div className="text-muted-foreground text-xs font-medium">
              Step {step + 1} of 3
            </div>
          </div>

          <div className="mt-4 flex items-center">
            {STEPS.map((s, idx) => {
              const isCurrent = idx === step;
              const isDone = idx < step;
              return (
                <div key={s.id} className="flex flex-1 items-center last:flex-none">
                  <button
                    type="button"
                    onClick={() => idx < step && setStep(idx)}
                    disabled={idx > step}
                    className={cn('flex items-center gap-2', idx < step ? 'cursor-pointer' : 'cursor-default')}
                  >
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors',
                        isCurrent
                          ? 'bg-primary text-primary-foreground'
                          : isDone
                            ? 'bg-primary/15 text-primary'
                            : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {isDone ? <CheckIcon className="size-3.5" /> : idx + 1}
                    </span>
                    <span
                      className={cn(
                        'text-xs font-medium',
                        isCurrent ? 'text-foreground font-semibold' : 'text-muted-foreground',
                      )}
                    >
                      {s.label}
                    </span>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div className={cn('mx-3 h-px flex-1', isDone ? 'bg-primary/40' : 'bg-border')} />
                  )}
                </div>
              );
            })}
          </div>
        </SheetHeader>

        <Form id="create-server-form" className="flex-1 overflow-y-auto px-4 py-4" onSubmit={submit}>
          <FormFields>
            {step === 0 && (
              <div className="space-y-4">
                <Tabs
                  value={isExisting ? 'existing' : isCustom ? 'custom' : 'cloud'}
                  onValueChange={(val) => {
                    form.clearErrors();
                    if (val === 'existing') {
                      selectCombinedProvider('existing');
                    } else if (val === 'custom') {
                      selectCombinedProvider('custom');
                    } else {
                      if (serverProviders.length > 0) {
                        selectCombinedProvider(serverProviders[0].id.toString());
                      } else {
                        const firstCloud = Object.keys(configs.server_provider.providers).find(
                          (k) => k !== 'custom' && k !== 'existing',
                        );
                        if (firstCloud) {
                          form.setData('provider', firstCloud);
                        }
                      }
                    }
                  }}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="cloud">Cloud Provider</TabsTrigger>
                    <TabsTrigger value="custom">Custom Server</TabsTrigger>
                    <TabsTrigger value="existing">Existing Server</TabsTrigger>
                  </TabsList>
                </Tabs>

                {!isDirectSsh && (
                  <div className="space-y-4">
                    <FormField>
                      <Label htmlFor="provider">Provider Account</Label>
                      <div className="flex items-center gap-2">
                        <Select value={providerValue} onValueChange={selectCombinedProvider}>
                          <SelectTrigger id="provider" className="flex-1">
                            <SelectValue placeholder="Select a provider" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {Object.entries(configs.server_provider.providers)
                                .filter(([key]) => key !== 'custom' && key !== 'existing')
                                .map(([key, provider]) => {
                                  const connections = serverProviders.filter(
                                    (item: ServerProvider) => item.provider === key,
                                  );

                                  if (connections.length === 0) {
                                    return (
                                      <SelectItem key={`provider-${key}`} value={`unavailable-${key}`} disabled>
                                        {provider.label}
                                      </SelectItem>
                                    );
                                  }

                                  return connections.map((connection) => (
                                    <SelectItem key={`connection-${connection.id}`} value={connection.id.toString()}>
                                      {provider.label} - {connection.name}
                                    </SelectItem>
                                  ));
                                })}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <ConnectServerProvider
                          defaultProvider={!isDirectSsh ? form.data.provider : undefined}
                          onProviderAdded={fetchServerProviders}
                        >
                          <Button type="button" variant="outline" size="icon" aria-label="Add server provider">
                            <WifiIcon className="size-4" />
                          </Button>
                        </ConnectServerProvider>
                      </div>
                      <InputError message={form.errors.provider || form.errors.server_provider} />
                    </FormField>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField>
                        <Label htmlFor="region">Region</Label>
                        {form.data.provider === 'hetzner' ? (
                          <HetznerRegionSelect
                            value={form.data.region}
                            loading={regionLoading}
                            onChange={(region) => {
                              selectRegion(region);
                            }}
                          />
                        ) : (
                          <Popover open={regionOpen} onOpenChange={setRegionOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                id="region"
                                variant="outline"
                                role="combobox"
                                aria-expanded={regionOpen}
                                className="w-full justify-between font-normal"
                                disabled={form.data.server_provider === 0}
                              >
                                {form.data.region ? regions[form.data.region] || form.data.region : 'Select region'}
                                <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Search region..." />
                                <CommandList>
                                  <CommandGroup>
                                    {Object.entries(regions).map(([key, value]) => (
                                      <CommandItem
                                        key={`region-${key}`}
                                        value={value}
                                        onSelect={() => {
                                          selectRegion(key);
                                          setRegionOpen(false);
                                        }}
                                      >
                                        {value}
                                        <CheckIcon
                                          className={cn(
                                            'ml-auto',
                                            form.data.region === key ? 'opacity-100' : 'opacity-0',
                                          )}
                                        />
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        )}
                        <InputError message={form.errors.region} />
                      </FormField>

                      <FormField>
                        <Label htmlFor="plan">Plan</Label>
                        {form.data.provider === 'hetzner' ? (
                          <HetznerPlanSelect
                            value={form.data.plan}
                            onChange={(plan) => {
                              selectPlan(plan);
                            }}
                          />
                        ) : (
                          <Popover open={planOpen} onOpenChange={setPlanOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                id="plan"
                                variant="outline"
                                role="combobox"
                                aria-expanded={planOpen}
                                className="w-full justify-between font-normal"
                                disabled={form.data.region === ''}
                              >
                                {form.data.plan
                                  ? plans[form.data.plan]
                                    ? normalizePlan(plans[form.data.plan]).label
                                    : form.data.plan
                                  : 'Select plan'}
                                <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Search plan..." />
                                <CommandList>
                                  <CommandGroup>
                                    {Object.entries(plans).map(([key, value]) => {
                                      const plan = normalizePlan(value);
                                      return (
                                        <CommandItem
                                          key={`plan-${key}`}
                                          value={plan.label}
                                          disabled={!plan.available}
                                          onSelect={() => {
                                            selectPlan(key);
                                            setPlanOpen(false);
                                          }}
                                        >
                                          {plan.label}
                                          {!plan.available && (
                                            <span className="text-muted-foreground ml-2">(unavailable)</span>
                                          )}
                                          <CheckIcon
                                            className={cn(
                                              'ml-auto',
                                              form.data.plan === key ? 'opacity-100' : 'opacity-0',
                                            )}
                                          />
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        )}
                        <InputError message={form.errors.plan} />
                      </FormField>
                    </div>
                  </div>
                )}

                {isDirectSsh && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 items-start gap-4">
                      <FormField>
                        <Label htmlFor="ip">SSH IP</Label>
                        <Input
                          id="ip"
                          type="text"
                          placeholder="192.168.1.1"
                          autoComplete="ip"
                          value={form.data.ip}
                          onChange={(e) => form.setData('ip', e.target.value)}
                        />
                        <InputError message={form.errors.ip} />
                      </FormField>

                      <FormField>
                        <Label htmlFor="port">SSH Port</Label>
                        <Input
                          id="port"
                          type="number"
                          placeholder="22"
                          autoComplete="port"
                          value={form.data.port || ''}
                          onChange={(e) => form.setData('port', parseInt(e.target.value) || 22)}
                        />
                        <InputError message={form.errors.port} />
                      </FormField>
                    </div>

                    <FormField>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="public_key" className="text-xs">
                          {isExisting
                            ? 'Run this command on your existing server as root:'
                            : 'Run this command on your fresh server as root:'}
                        </Label>
                        <button
                          type="button"
                          onClick={copyToClipboard}
                          className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-xs"
                        >
                          {copySuccess ? (
                            <ClipboardCheckIcon className="text-success size-3" />
                          ) : (
                            <ClipboardIcon className="size-3" />
                          )}
                          <span>{copySuccess ? 'Copied' : 'Copy command'}</span>
                        </button>
                      </div>
                      <Textarea
                        onClick={copyToClipboard}
                        id="public_key"
                        value={publicKeyText}
                        readOnly
                        rows={3}
                        className="bg-muted/40 font-mono text-xs overflow-auto resize-none cursor-pointer"
                        spellCheck={false}
                      />
                      <p className="text-muted-foreground text-xs">
                        {isExisting
                          ? 'Safely authorizes Vito via SSH. Existing websites, packages, and keys are preserved.'
                          : 'Adds Vito SSH key to /root/.ssh/authorized_keys for clean provisioning.'}
                      </p>
                    </FormField>
                  </div>
                )}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 items-start gap-4">
                  <FormField>
                    <Label htmlFor="role">Server Type</Label>
                    <Select
                      value={form.data.role}
                      onValueChange={(value: CreateServerForm['role']) => {
                        form.setData('role', value);
                        form.setData('services', servicesForRole(value));
                      }}
                    >
                      <SelectTrigger id="role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {configs.server_roles.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <InputError message={form.errors.role} />
                  </FormField>

                  <FormField>
                    <Label htmlFor="stage">Stage</Label>
                    <Select
                      value={form.data.stage}
                      onValueChange={(value: 'prod' | 'beta' | 'alfa') => form.setData('stage', value)}
                    >
                      <SelectTrigger id="stage">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prod">Prod</SelectItem>
                        <SelectItem value="beta">Beta</SelectItem>
                        <SelectItem value="alfa">Alfa</SelectItem>
                      </SelectContent>
                    </Select>
                    <InputError message={form.errors.stage} />
                  </FormField>

                  <FormField>
                    <Label htmlFor="name">Server Name</Label>
                    <Input
                      id="name"
                      type="text"
                      autoComplete="name"
                      value={form.data.name}
                      onChange={(e) => {
                        setNameEdited(true);
                        form.setData('name', e.target.value);
                      }}
                    />
                    <InputError message={form.errors.name} />
                  </FormField>

                  <FormField>
                    <Label htmlFor="os">Operating System</Label>
                    <Select value={form.data.os} onValueChange={(value) => form.setData('os', value)}>
                      <SelectTrigger id="os">
                        <SelectValue placeholder="Select an operating system" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {configs.operating_systems.map((value) => (
                            <SelectItem key={`os-${value}`} value={value}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <InputError message={form.errors.os} />
                  </FormField>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                  <span className="font-semibold text-foreground">{form.data.name || 'Unnamed'}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground uppercase">{form.data.stage}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="capitalize">{form.data.provider}</span>
                  {isDirectSsh && form.data.ip && (
                    <span className="text-muted-foreground">({form.data.ip})</span>
                  )}
                  {!isDirectSsh && form.data.plan && (
                    <span className="text-muted-foreground">({form.data.plan})</span>
                  )}
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{form.data.os}</span>
                </div>

                <div>
                  <FormField>
                    <div className="flex items-center justify-between pb-2">
                      <Label className="text-sm font-medium">Services</Label>
                      <ServerTemplates services={form.data.services} onTemplateChanged={serverTemplateChanged} />
                    </div>
                    <div className="rounded-md border">
                      <DataTable columns={servicesColumns} data={form.data.services} />
                    </div>
                    {Object.entries(form.errors)
                      .filter(([key, value]) => key.startsWith('services') && value.length > 0)
                      .map(([key, value]) => (
                        <InputError key={key} message={value} />
                      ))}
                  </FormField>
                </div>
              </div>
            )}
          </FormFields>
        </Form>

        <SheetFooter className="border-t px-4 py-3">
          <div className="flex w-full items-center justify-between">
            <div>
              {step > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep((s) => s - 1)}
                  disabled={form.processing}
                >
                  <ArrowLeftIcon className="mr-1 size-4" /> Back
                </Button>
              ) : (
                <SheetClose asChild>
                  <Button variant="outline" disabled={form.processing}>
                    Cancel
                  </Button>
                </SheetClose>
              )}
            </div>

            <div className="flex items-center gap-2">
              {step < 2 ? (
                <Button
                  type="button"
                  onClick={() => {
                    form.clearErrors();
                    if (step === 0 && !canGoNextFromStep0()) return;
                    if (step === 1 && !canGoNextFromStep1()) return;
                    setStep((s) => s + 1);
                  }}
                >
                  Next <ArrowRightIcon className="ml-1 size-4" />
                </Button>
              ) : (
                <Button type="submit" form="create-server-form" disabled={form.processing}>
                  {form.processing && <LoaderCircle className="mr-1 animate-spin" />}{' '}
                  {isExisting ? 'Connect Server' : 'Create Server'}
                </Button>
              )}
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
