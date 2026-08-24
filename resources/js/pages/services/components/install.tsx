import React, { FormEvent, ReactNode, useMemo, useState } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ActivityIcon,
  CheckCircle2Icon,
  CheckIcon,
  CodeIcon,
  CpuIcon,
  DatabaseIcon,
  FlameIcon,
  GlobeIcon,
  HardDriveIcon,
  ListEndIcon,
  LoaderCircleIcon,
  SearchIcon,
  ShieldIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConfigs } from '@/stores/bootstrap-store';

const CATEGORY_LABELS: Record<string, string> = {
  webserver: 'Web Server',
  database: 'Database',
  memory_database: 'Cache / In-Memory',
  php: 'PHP',
  node: 'Node.js',
  firewall: 'Firewall',
  fail2ban: 'Security',
  process_manager: 'Process Manager',
  monitoring: 'Monitoring',
  log_analysis: 'Log Analysis',
};

function getServiceIcon(type: string) {
  switch (type) {
    case 'webserver':
      return GlobeIcon;
    case 'database':
      return DatabaseIcon;
    case 'memory_database':
      return HardDriveIcon;
    case 'php':
    case 'node':
      return CodeIcon;
    case 'firewall':
      return FlameIcon;
    case 'fail2ban':
      return ShieldIcon;
    case 'process_manager':
      return ListEndIcon;
    case 'monitoring':
    case 'log_analysis':
      return ActivityIcon;
    default:
      return CpuIcon;
  }
}

export default function InstallService({ name, children }: { name?: string; children: ReactNode }) {
  const page = usePage<{ server: Server }>();
  const configs = useConfigs()!;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const form = useForm<{
    type: string;
    name: string;
    version: string;
  }>({
    type: '',
    name: name ?? '',
    version: '',
  });

  const allServices = useMemo(() => {
    if (!configs?.service?.services) return [];
    return Object.entries(configs.service.services)
      .filter(([, service]) => service.type !== 'vpn')
      .map(([key, service]) => ({
        key,
        ...service,
      }));
  }, [configs]);

  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return allServices;
    return allServices.filter((s) => {
      return (
        s.label.toLowerCase().includes(query) ||
        s.key.toLowerCase().includes(query) ||
        (CATEGORY_LABELS[s.type] ?? s.type).toLowerCase().includes(query)
      );
    });
  }, [allServices, search]);

  const handleSelectService = (serviceKey: string) => {
    const service = configs.service.services[serviceKey];
    if (!service) return;

    form.setData({
      type: service.type,
      name: serviceKey,
      version: service.versions && service.versions.length > 0 ? service.versions[0] : 'latest',
    });
  };

  const handleSelectVersion = (version: string) => {
    form.setData('version', version);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.data.name) return;

    form.post(route('services.store', { server: page.props.server.id }), {
      onSuccess: () => {
        setOpen(false);
        form.reset();
        setSearch('');
      },
    });
  };

  const selectedService = form.data.name ? configs?.service?.services?.[form.data.name] : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="text-base font-semibold">Install Service</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Select a service to install on <strong className="text-foreground">{page.props.server.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 py-2 border-b bg-muted/20">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search services (e.g. PHP, Nginx, MySQL, Redis, Node)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs pl-8 bg-background"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 max-h-[52vh]">
          {filteredServices.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <SearchIcon className="size-6 mb-1.5 opacity-40" />
              <p className="text-xs font-medium">No services found matching "{search}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredServices.map((service) => {
                const isSelected = form.data.name === service.key;
                const IconComponent = getServiceIcon(service.type);
                const hasMultipleVersions = service.versions && service.versions.length > 1;

                return (
                  <div
                    key={service.key}
                    onClick={() => handleSelectService(service.key)}
                    className={cn(
                      'group relative rounded-lg border p-2.5 transition-all cursor-pointer flex flex-col gap-1.5 text-left select-none',
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                        : 'hover:border-border/80 hover:bg-muted/40'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={cn(
                            'p-1.5 rounded-md border shrink-0 transition-colors',
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-muted text-muted-foreground group-hover:text-foreground'
                          )}
                        >
                          <IconComponent className="size-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-xs leading-none truncate block text-foreground">
                            {service.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground leading-none">
                            {CATEGORY_LABELS[service.type] ?? service.type}
                          </span>
                        </div>
                      </div>

                      {isSelected ? (
                        <CheckCircle2Icon className="size-4 text-primary shrink-0" />
                      ) : (
                        <div className="size-4 rounded-full border border-muted-foreground/30 shrink-0" />
                      )}
                    </div>

                    {isSelected && hasMultipleVersions && (
                      <div
                        className="pt-1.5 mt-0.5 border-t flex flex-wrap gap-1 items-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[10px] font-medium text-muted-foreground mr-1">Version:</span>
                        {service.versions.map((ver: string) => {
                          const isVersionActive = form.data.version === ver;
                          return (
                            <button
                              key={ver}
                              type="button"
                              onClick={() => handleSelectVersion(ver)}
                              className={cn(
                                'px-1.5 py-0.5 rounded text-[11px] font-mono border transition-colors',
                                isVersionActive
                                  ? 'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                                  : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground'
                              )}
                            >
                              {ver}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="px-4 py-2.5 border-t flex flex-row items-center justify-between bg-muted/20 sm:justify-between">
          <div className="text-xs text-muted-foreground truncate max-w-[55%]">
            {selectedService ? (
              <span className="flex items-center gap-1.5">
                <CheckIcon className="size-3.5 text-primary shrink-0" />
                <span className="truncate">
                  Selected: <strong className="text-foreground">{selectedService.label}</strong>
                  {form.data.version && (
                    <Badge variant="outline" className="ml-1 text-[10px] font-mono py-0 px-1">
                      {form.data.version}
                    </Badge>
                  )}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">Select a service above</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <DialogClose asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={submit}
              disabled={!form.data.name || form.processing}
              size="sm"
              className="h-8 text-xs min-w-20"
            >
              {form.processing ? (
                <>
                  <LoaderCircleIcon className="size-3.5 animate-spin mr-1" />
                  Installing...
                </>
              ) : (
                'Install'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
