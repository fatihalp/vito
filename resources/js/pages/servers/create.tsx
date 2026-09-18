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
  ServerIcon,
  TrashIcon,
  WifiIcon,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Head, Link, useForm } from '@inertiajs/react';
import React, { FormEventHandler, useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InputError from '@/components/ui/input-error';
import { Input } from '@/components/ui/input';
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
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import ServerTemplates from './components/templates';
import { ServerTemplate, Service } from '@/types/server-template';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import HetznerRegionSelect from './components/hetzner-region-select';
import { fetchHetznerLatencies } from './components/hetzner-regions';
import HetznerPlanSelect from './components/hetzner-plan-select';
import { toast } from 'sonner';
import { useSocketListener } from '@/hooks/use-socket-events';
import type { ServerRole } from '@/lib/server-roles';
import Layout from '@/layouts/app/layout';
import Container from '@/components/container';

const STEPS = [
  { id: 'provider', label: 'Provider & Connection' },
  { id: 'details', label: 'Server Details' },
  { id: 'services', label: 'Services & Launch' },
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
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 cursor-pointer">
          <PlusIcon className="size-3.5" />
          <span>Add service</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add service</DialogTitle>
          <DialogDescription className="sr-only">Add a new service to server installation</DialogDescription>
        </DialogHeader>

        <Form id="add-service-form" onSubmit={add} className="p-4">
          <FormFields>
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

            <FormField>
              <Label htmlFor="version">Version</Label>
              <Select
                value={form.data.version}
                disabled={!form.data.name}
                onValueChange={(value) => form.setData('version', value)}
              >
                <SelectTrigger id="version">
                  <SelectValue placeholder="Select a version" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {form.data.name &&
                      configs.service.services[form.data.name].versions.map((version) => (
                        <SelectItem key={`version-${version}`} value={version}>
                          {version}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <InputError message={form.errors.version} />
            </FormField>

            <Button type="button" onClick={add} className="w-full">
              Add
            </Button>
          </FormFields>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const servicesColumns: ColumnDef<Service>[] = [
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => <span className="capitalize">{row.original.type.replace('_', ' ')}</span>,
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => <span className="capitalize">{row.original.name.replace('_', ' ')}</span>,
  },
  {
    accessorKey: 'version',
    header: 'Version',
    cell: ({ row }) => <span>{row.original.version}</span>,
  },
  {
    accessorKey: 'actions',
    header: () => <AddService />,
    cell: ({ row }) => {
      const isBaseService = baseServices.some((service) => service.name === row.original.name);

      if (isBaseService) {
        return null;
      }

      return (
        <div className="flex items-center justify-end">
          <button
            type="button"
            className="cursor-pointer text-muted-foreground hover:text-destructive transition-colors"
            onClick={() => {
              EventBus.emit('remove-service', row.original);
            }}
          >
            <TrashIcon className="size-4" />
          </button>
        </div>
      );
    },
  },
];

export default function CreateServerPage({
  server_providers: initialProviders,
  public_key: initialPublicKey,
}: {
  server_providers?: { data?: ServerProvider[] } | ServerProvider[];
  public_key?: string;
}) {
  const configs = useConfigs()!;
  const bootstrapPublicKey = usePublicKeyText();
  const publicKey = initialPublicKey || bootstrapPublicKey;

  const [step, setStep] = useState<number>(0);
  const [roleConfirmed, setRoleConfirmed] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [providers, setProviders] = useState<ServerProvider[]>(() => {
    if (Array.isArray(initialProviders)) return initialProviders;
    if (initialProviders && Array.isArray((initialProviders as any).data)) return (initialProviders as any).data;
    return [];
  });

  const [providerOpen, setProviderOpen] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [regionLoading, setRegionLoading] = useState(false);
  const [regions, setRegions] = useState<{ [key: string]: string }>({});
  const [plans, setPlans] = useState<{ [key: string]: string | PlanOption }>({});

  const defaultProvider = providers[0];

  const form = useForm<CreateServerForm>({
    role: 'app',
    provider: defaultProvider ? defaultProvider.provider : 'custom',
    server_provider: defaultProvider ? defaultProvider.id : 0,
    name: '',
    os: 'ubuntu_24',
    ip: '',
    port: 22,
    region: '',
    plan: '',
    services: servicesForRole('app'),
    stage: 'prod',
  });

  const activeProvider = form.data.provider;
  const isCustom = activeProvider === 'custom';
  const isExisting = activeProvider === 'existing';
  const isDirectSsh = isCustom || isExisting;
  const isHetzner = activeProvider === 'hetzner';

  const providerMode: 'cloud' | 'custom' | 'existing' = isExisting
    ? 'existing'
    : isCustom
    ? 'custom'
    : 'cloud';

  useEffect(() => {
    if (defaultProvider) {
      fetchRegions(defaultProvider.id, defaultProvider.provider);
    }
    // Only for the connection pre-selected on mount; later switches are handled by selectProviderMode/handleProviderSelect.
  }, []);

  useEffect(() => {
    if (!form.data.name) {
      form.setData(
        'name',
        generateServerName(form.data.role, form.data.stage, isDirectSsh ? 'ssh' : form.data.region),
      );
    }
  }, [form.data.role, form.data.stage, form.data.region, isDirectSsh]);

  useEffect(() => {
    const handleAddService = (d: unknown) => {
      const service = d as Service;
      const exists = form.data.services.some(
        (s) => s.name === service.name && s.version === service.version,
      );
      if (!exists) {
        form.setData('services', [...form.data.services, service]);
      }
    };

    const handleRemoveService = (d: unknown) => {
      const service = d as Service;
      form.setData(
        'services',
        form.data.services.filter(
          (s) => !(s.name === service.name && s.version === service.version),
        ),
      );
    };

    EventBus.on('add-service', handleAddService);
    EventBus.on('remove-service', handleRemoveService);

    return () => {
      EventBus.off('add-service', handleAddService);
      EventBus.off('remove-service', handleRemoveService);
    };
  }, [form.data.services]);

  const selectProviderMode = (mode: 'cloud' | 'custom' | 'existing') => {
    form.clearErrors();
    setRegions({});
    setPlans({});

    if (mode === 'existing') {
      form.setData((prev) => ({
        ...prev,
        provider: 'existing',
        server_provider: 0,
        role: 'custom',
        services: servicesForRole('custom'),
        region: '',
        plan: '',
      }));
    } else if (mode === 'custom') {
      form.setData((prev) => ({
        ...prev,
        provider: 'custom',
        server_provider: 0,
        region: '',
        plan: '',
      }));
    } else {
      const firstCloud = providers[0];
      if (firstCloud) {
        form.setData((prev) => ({
          ...prev,
          provider: firstCloud.provider,
          server_provider: firstCloud.id,
          ip: '',
          port: 22,
          region: '',
          plan: '',
        }));
        fetchRegions(firstCloud.id, firstCloud.provider);
      } else {
        form.setData((prev) => ({
          ...prev,
          provider: 'hetzner',
          server_provider: 0,
          ip: '',
          port: 22,
          region: '',
          plan: '',
        }));
      }
    }
  };

  const fetchServerProviders = async () => {
    try {
      const response = await axios.get<ServerProvider[]>(route('server-providers.json'));
      setProviders(response.data);
    } catch {
      // silent
    }
  };

  const fetchPlans = async (serverProvider: number, region: string) => {
    try {
      const res = await axios.get(
        route('server-providers.plans', {
          serverProvider: serverProvider,
          region: region,
        }),
      );
      setPlans(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not fetch plans');
    }
  };

  const selectRegion = async (region: string, providerId = form.data.server_provider) => {
    form.setData('region', region);
    if (region !== '' && providerId > 0) {
      await fetchPlans(providerId, region);
    }
  };

  const selectPlan = (plan: string) => {
    form.setData('plan', plan);
  };

  const fetchRegions = async (serverProvider: number, providerName?: string) => {
    setRegionLoading(true);
    try {
      const regionsRes = await axios.get(
        route('server-providers.regions', { serverProvider: serverProvider }),
      );
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
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not fetch regions');
    } finally {
      setRegionLoading(false);
    }
  };

  const handleProviderSelect = async (p: ServerProvider) => {
    form.setData((prev) => ({
      ...prev,
      provider: p.provider,
      server_provider: p.id,
      region: '',
      plan: '',
    }));
    setProviderOpen(false);
    await fetchRegions(p.id, p.provider);
  };

  useSocketListener((event) => {
    if (event.type === 'server-provider.created') {
      const newProvider = event.data as ServerProvider;
      setProviders((prev) => [newProvider, ...prev]);
      handleProviderSelect(newProvider);
    }
  });

  const serverTemplateChanged = (template: ServerTemplate | null) => {
    if (!template) {
      form.setData('services', baseServices);
      return;
    }
    form.setData('services', [...template.services, ...baseServices]);
  };

  const copyPublicKeyCommand = () => {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey).then(() => {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
      toast.success('SSH setup command copied');
    });
  };

  const canGoNextFromStep0 = (): boolean => {
    if (isDirectSsh) {
      if (!form.data.ip.trim()) {
        form.setError('ip', 'Server IP is required');
        return false;
      }
      if (!form.data.port || form.data.port < 1) {
        form.setError('port', 'Valid SSH port required');
        return false;
      }
      return true;
    }
    if (!form.data.server_provider) {
      form.setError('server_provider', 'Select a cloud provider');
      return false;
    }
    if (!form.data.region) {
      form.setError('region', 'Select a region');
      return false;
    }
    if (!form.data.plan) {
      form.setError('plan', 'Select a plan');
      return false;
    }
    return true;
  };

  const canGoNextFromStep1 = (): boolean => {
    if (!form.data.name.trim()) {
      form.setError('name', 'Server name is required');
      return false;
    }
    return true;
  };

  const submit: FormEventHandler = (e) => {
    e.preventDefault();
    if (step < 2) {
      if (step === 0 && canGoNextFromStep0()) setStep(1);
      if (step === 1 && canGoNextFromStep1()) setStep(2);
      return;
    }
    if (!roleConfirmed) {
      return;
    }
    form.post(route('servers.store'));
  };

  useEffect(() => {
    if (form.hasErrors) {
      const step0Keys = ['provider', 'server_provider', 'region', 'plan', 'ip', 'port'];
      const step1Keys = ['name', 'stage'];
      const errors = Object.keys(form.errors);

      if (errors.some((k) => step0Keys.includes(k))) {
        setStep(0);
      } else if (errors.some((k) => step1Keys.includes(k))) {
        setStep(1);
      } else {
        setStep(2);
      }
    }
  }, [form.errors]);

  return (
    <Layout>
      <Head title="Create server" />

      <Container className="max-w-3xl py-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" asChild className="h-7 px-2 -ml-2 text-muted-foreground hover:text-foreground">
              <Link href={route('servers')}>
                <ArrowLeftIcon className="mr-1 size-3.5" />
                Back to servers
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Create new server</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect a pre-existing server or deploy a new instance on your cloud provider.
          </p>
        </div>

        <div className="rounded-2xl border bg-card text-card-foreground shadow-xs overflow-hidden">
          <div className="border-b bg-muted/20 px-6 py-4">
            <div className="flex items-center justify-between">
              {STEPS.map((s, idx) => {
                const isActive = step === idx;
                const isDone = step > idx;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      if (isDone) setStep(idx);
                    }}
                    className={cn(
                      'flex items-center gap-2 text-xs font-medium transition-colors',
                      isDone && 'cursor-pointer text-foreground hover:text-primary',
                      isActive && 'text-primary font-semibold',
                      !isActive && !isDone && 'text-muted-foreground/60 cursor-default',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                        isDone && 'bg-emerald-500 text-white',
                        isActive && 'bg-primary text-primary-foreground',
                        !isActive && !isDone && 'bg-muted text-muted-foreground border',
                      )}
                    >
                      {isDone ? <CheckIcon className="size-3" /> : idx + 1}
                    </span>
                    <span>{s.label}</span>
                    {idx < STEPS.length - 1 && (
                      <span className="text-muted-foreground/40 ml-4 hidden sm:inline">/</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <Form id="create-server-form" onSubmit={submit} className="p-6 sm:p-8">
            <FormFields className="space-y-6">
              {step === 0 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Connection Type</Label>
                    <Tabs value={providerMode} onValueChange={(value) => selectProviderMode(value as 'cloud' | 'custom' | 'existing')}>
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="cloud">Cloud Provider</TabsTrigger>
                        <TabsTrigger value="custom">Custom Server</TabsTrigger>
                        <TabsTrigger value="existing">Existing Server</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {!isDirectSsh && (
                    <div className="space-y-4">
                      <FormField>
                        <div className="flex items-center justify-between pb-1">
                          <Label>Cloud Provider</Label>
                          <ConnectServerProvider
                            defaultProvider={!isDirectSsh ? form.data.provider : undefined}
                            onProviderAdded={fetchServerProviders}
                          >
                            <Button type="button" variant="outline" size="icon" aria-label="Add server provider">
                              <WifiIcon className="size-4" />
                            </Button>
                          </ConnectServerProvider>
                        </div>

                        <Popover open={providerOpen} onOpenChange={setProviderOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between font-normal"
                            >
                              {providers.find((p) => p.id === form.data.server_provider)?.name ||
                                'Select cloud provider...'}
                              <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
                            <Command>
                              <CommandInput placeholder="Search provider..." />
                              <CommandList>
                                <CommandGroup>
                                  {providers.map((provider) => (
                                    <CommandItem
                                      key={provider.id}
                                      value={provider.name}
                                      onSelect={() => handleProviderSelect(provider)}
                                    >
                                      <CheckIcon
                                        className={cn(
                                          'mr-2 size-4',
                                          form.data.server_provider === provider.id
                                            ? 'opacity-100'
                                            : 'opacity-0',
                                        )}
                                      />
                                      {provider.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <InputError message={form.errors.server_provider} />
                      </FormField>

                      {Object.keys(regions).length > 0 && (
                        <FormField>
                          <Label htmlFor="region">Region</Label>
                          {isHetzner ? (
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
                                  type="button"
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
                                              'ml-auto size-4',
                                              form.data.region === key ? 'opacity-100' : 'opacity-0'
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
                      )}

                      {Object.keys(plans).length > 0 && (
                        <FormField>
                          <Label htmlFor="plan">Server Plan</Label>
                          {isHetzner ? (
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
                                  type="button"
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
                                            <CheckIcon
                                              className={cn(
                                                'ml-auto size-4',
                                                form.data.plan === key ? 'opacity-100' : 'opacity-0'
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
                      )}
                    </div>
                  )}

                  {isDirectSsh && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                        <FormField className="sm:col-span-3">
                          <Label htmlFor="ip">IP Address</Label>
                          <Input
                            id="ip"
                            placeholder="e.g. 192.168.1.100"
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
                            value={form.data.port}
                            onChange={(e) => form.setData('port', parseInt(e.target.value) || 22)}
                          />
                          <InputError message={form.errors.port} />
                        </FormField>
                      </div>

                      {publicKey && (
                        <div className="space-y-1.5 rounded-xl border bg-muted/40 p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground">Vito Public SSH Key</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1 cursor-pointer"
                              onClick={copyPublicKeyCommand}
                            >
                              {copiedKey ? (
                                <>
                                  <ClipboardCheckIcon className="size-3 text-emerald-500" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <ClipboardIcon className="size-3" />
                                  <span>Copy Command</span>
                                </>
                              )}
                            </Button>
                          </div>
                          <pre className="mt-2 max-h-24 min-w-0 overflow-auto rounded-lg bg-background p-2.5 font-mono text-[11px] whitespace-pre-wrap break-all text-muted-foreground border">
                            {publicKey}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Environment / Stage</Label>
                    <div className="mt-1.5 grid grid-cols-3 gap-2">
                      {(['prod', 'beta', 'alfa'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => form.setData('stage', s)}
                          className={cn(
                            'rounded-lg border py-1.5 text-center text-xs font-medium uppercase transition-colors cursor-pointer',
                            form.data.stage === s
                              ? 'border-primary bg-primary/10 text-primary font-semibold'
                              : 'border-border text-muted-foreground hover:bg-muted/50',
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <FormField>
                    <Label htmlFor="name">Server Name</Label>
                    <Input
                      id="name"
                      value={form.data.name}
                      onChange={(e) => form.setData('name', e.target.value)}
                    />
                    <InputError message={form.errors.name} />
                  </FormField>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-xl border p-3 text-xs">
                    <span className="font-semibold text-foreground">{form.data.name || 'Unnamed'}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground uppercase">{form.data.stage}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="capitalize">{form.data.provider}</span>
                    {isDirectSsh && form.data.ip && (
                      <span className="text-muted-foreground font-mono">({form.data.ip})</span>
                    )}
                    {!isDirectSsh && form.data.plan && (
                      <span className="text-muted-foreground font-mono">({form.data.plan})</span>
                    )}
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">{form.data.os}</span>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Server Role</Label>
                    {!roleConfirmed && (
                      <div className="text-muted-foreground mt-1 text-xs">Confirm the role for this server before continuing.</div>
                    )}
                    <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                      {(['app', 'database', 'queue', 'cache', 'custom'] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            form.setData((prev) => ({
                              ...prev,
                              role: r,
                              services: servicesForRole(r),
                            }));
                            setRoleConfirmed(true);
                          }}
                          className={cn(
                            'rounded-lg border py-2 text-center text-xs font-medium capitalize transition-colors cursor-pointer',
                            form.data.role === r
                              ? 'border-primary bg-primary/10 text-primary font-semibold'
                              : 'border-border text-muted-foreground hover:bg-muted/50',
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

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

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Services</Label>
                      <ServerTemplates services={form.data.services} onTemplateChanged={serverTemplateChanged} />
                    </div>
                    <div className="rounded-xl border overflow-hidden">
                      <DataTable columns={servicesColumns} data={form.data.services} />
                    </div>
                    {Object.entries(form.errors)
                      .filter(([key, value]) => key.startsWith('services') && value.length > 0)
                      .map(([key, value]) => (
                        <InputError key={key} message={value} />
                      ))}
                  </div>
                </div>
              )}
            </FormFields>

            <div className="mt-8 pt-4 border-t flex items-center justify-between">
              <div>
                {step > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep((s) => s - 1)}
                    disabled={form.processing}
                  >
                    <ArrowLeftIcon className="mr-1.5 size-4" /> Back
                  </Button>
                ) : (
                  <Button variant="outline" asChild disabled={form.processing}>
                    <Link href={route('servers')}>Cancel</Link>
                  </Button>
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
                    Next <ArrowRightIcon className="ml-1.5 size-4" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={form.processing || !roleConfirmed}>
                    {form.processing && <LoaderCircle className="mr-1.5 animate-spin size-4" />}
                    {isExisting ? 'Connect Server' : 'Create Server'}
                  </Button>
                )}
              </div>
            </div>
          </Form>
        </div>
      </Container>
    </Layout>
  );
}
