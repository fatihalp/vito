import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { generatePassword, WORKFLOW_TEMPLATES, WorkflowTemplate, WorkflowTemplateConfig } from './templates';
import { useForm } from '@inertiajs/react';
import {
  BoxesIcon,
  CheckCircle2Icon,
  CloudIcon,
  DatabaseIcon,
  GlobeIcon,
  KeyIcon,
  LayersIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  ServerIcon,
  SparklesIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import InputError from '@/components/ui/input-error';
import { useInputFocus } from '@/stores/useInputFocus';
import { ServerProvider } from '@/types/server-provider';
import axios from 'axios';
import { toast } from 'sonner';

export default function WorkflowTemplatesDialog({
  open,
  onOpenChange,
  initialTemplateId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTemplateId?: string;
}) {
  const setFocused = useInputFocus((state) => state.setFocused);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialTemplateId || WORKFLOW_TEMPLATES[0].id);
  const [serverProviders, setServerProviders] = useState<ServerProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);

  const selectedTemplate = useMemo(() => {
    return WORKFLOW_TEMPLATES.find((t) => t.id === selectedTemplateId) || WORKFLOW_TEMPLATES[0];
  }, [selectedTemplateId]);

  const form = useForm<{
    workflowName: string;
    serverProviderId: string;
    plan: string;
    region: string;
    domain: string;
    repository: string;
    branch: string;
    dbName: string;
    dbUser: string;
    dbPassword: string;
    phpVersion: string;
  }>({
    workflowName: selectedTemplate.name,
    serverProviderId: '',
    plan: 'cx22',
    region: 'fsn1',
    domain: 'app.example.com',
    repository: 'laravel/laravel',
    branch: 'main',
    dbName: 'laravel',
    dbUser: 'laravel',
    dbPassword: generatePassword(),
    phpVersion: '8.3',
  });

  const importForm = useForm<{
    name: string;
  }>({
    name: '',
  });

  useEffect(() => {
    setFocused(open);
    return () => setFocused(false);
  }, [open, setFocused]);

  useEffect(() => {
    if (open) {
      setLoadingProviders(true);
      axios
        .get<ServerProvider[]>(route('server-providers.json'))
        .then((res) => {
          const providers = res.data || [];
          setServerProviders(providers);
          const hetzner = providers.find((p) => p.provider === 'hetzner');
          if (hetzner) {
            form.setData('serverProviderId', hetzner.id.toString());
          }
        })
        .catch(() => {
          
        })
        .finally(() => {
          setLoadingProviders(false);
        });
    }
  }, [open]);

  const handleSelectTemplate = (template: WorkflowTemplate) => {
    setSelectedTemplateId(template.id);
    form.setData('workflowName', template.name);
  };

  const regeneratePassword = () => {
    form.setData('dbPassword', generatePassword());
  };

  const hetznerProviders = useMemo(() => {
    return serverProviders.filter((p) => p.provider === 'hetzner');
  }, [serverProviders]);

  const submit = (e: FormEvent) => {
    e.preventDefault();

    const config: WorkflowTemplateConfig = {
      workflowName: form.data.workflowName.trim() || selectedTemplate.name,
      serverProviderId: form.data.serverProviderId ? Number(form.data.serverProviderId) : undefined,
      plan: form.data.plan,
      region: form.data.region,
      domain: form.data.domain.trim() || 'app.example.com',
      repository: form.data.repository.trim() || 'laravel/laravel',
      branch: form.data.branch.trim() || 'main',
      dbName: form.data.dbName.trim() || 'laravel',
      dbUser: form.data.dbUser.trim() || 'laravel',
      dbPassword: form.data.dbPassword,
      phpVersion: form.data.phpVersion,
    };

    const { name, nodes, edges } = selectedTemplate.generateNodesAndEdges(config);

    importForm.transform(() => ({
      name,
      nodes,
      edges,
    }));

    importForm.post(route('workflows.import'), {
      onSuccess: () => {
        toast.success(`Workflow "${name}" created successfully!`);
        onOpenChange(false);
      },
      onError: (errors) => {
        toast.error('Failed to create workflow: ' + (Object.values(errors)[0] || 'Unknown error'));
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col p-0 sm:max-w-5xl">
        <DialogHeader className="border-b p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                <SparklesIcon className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg">Laravel Workflow Templates</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Create a production-ready Laravel workflow with one click using Hetzner as the default cloud provider.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
          {}
          <div className="bg-muted/20 flex w-full flex-col border-b md:w-5/12 md:border-r md:border-b-0">
            <div className="border-b p-3">
              <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">Architecture Archetypes</span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              {WORKFLOW_TEMPLATES.map((template) => {
                const isSelected = selectedTemplate.id === template.id;
                const IconComponent = template.icon === 'server' ? ServerIcon : BoxesIcon;

                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleSelectTemplate(template)}
                    className={cn(
                      'relative w-full rounded-xl border p-3.5 text-left transition-all',
                      isSelected
                        ? 'border-primary bg-primary/10 ring-primary shadow-sm ring-1'
                        : 'border-border/70 bg-card hover:border-border hover:bg-accent/40 text-foreground',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                          isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <IconComponent className="size-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className={cn('truncate text-sm font-semibold', isSelected ? 'text-primary' : 'text-foreground')}>
                            {template.label}
                          </span>
                          <Badge variant={isSelected ? 'default' : 'gray'} className="shrink-0 px-1.5 py-0 text-[10px]">
                            {template.badge}
                          </Badge>
                        </div>

                        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">{template.description}</p>

                        <div className="text-muted-foreground mt-2.5 flex items-center gap-2 text-[11px]">
                          <span className="flex items-center gap-1">
                            <CloudIcon className="text-primary/70 size-3" />
                            Hetzner Default
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-medium">
                            <ServerIcon className="text-muted-foreground size-3" />
                            {template.serverCount} {template.serverCount === 1 ? 'Server' : 'Servers'}
                          </span>
                          <span>•</span>
                          <span>{template.steps.length} Steps</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              <div className="bg-card/50 text-muted-foreground rounded-lg border border-dashed p-3 text-xs">
                <div className="text-foreground mb-1 flex items-center gap-1.5 font-medium">
                  <LayersIcon className="text-primary size-3.5" />
                  Full Customizability
                </div>
                Once created, you can visually drag, add, delete, connect, or modify any node in the workflow canvas.
              </div>
            </div>
          </div>

          {}
          <div className="bg-background flex flex-1 flex-col overflow-y-auto p-4 sm:p-5">
            <form id="workflow-template-form" onSubmit={submit} className="space-y-4">
              {}
              <div className="bg-muted/40 rounded-lg border p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{selectedTemplate.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {selectedTemplate.architecture}
                    </Badge>
                  </div>
                </div>
              </div>

              {}
              <div className="space-y-3">
                <div className="text-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <GlobeIcon className="text-primary size-3.5" /> Application & Workflow Settings
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="tpl-workflow-name" className="text-xs">
                      Workflow Name
                    </Label>
                    <Input
                      id="tpl-workflow-name"
                      value={form.data.workflowName}
                      onChange={(e) => form.setData('workflowName', e.target.value)}
                      className="h-8 text-xs"
                      required
                    />
                    <InputError message={form.errors.workflowName} />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="tpl-domain" className="text-xs">
                      Domain
                    </Label>
                    <Input
                      id="tpl-domain"
                      value={form.data.domain}
                      onChange={(e) => form.setData('domain', e.target.value)}
                      placeholder="app.example.com"
                      className="h-8 text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="tpl-repository" className="text-xs">
                      Git Repository
                    </Label>
                    <Input
                      id="tpl-repository"
                      value={form.data.repository}
                      onChange={(e) => form.setData('repository', e.target.value)}
                      placeholder="organization/repository"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="tpl-branch" className="text-xs">
                      Git Branch
                    </Label>
                    <Input
                      id="tpl-branch"
                      value={form.data.branch}
                      onChange={(e) => form.setData('branch', e.target.value)}
                      placeholder="main"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              {}
              <div className="space-y-3 border-t pt-1">
                <div className="text-foreground flex items-center gap-1.5 pt-2 text-xs font-semibold tracking-wider uppercase">
                  <CloudIcon className="text-primary size-3.5" /> Hetzner Cloud Infrastructure
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor="tpl-server-provider" className="text-xs">
                      Hetzner Account
                    </Label>
                    <Select
                      value={form.data.serverProviderId}
                      onValueChange={(val) => form.setData('serverProviderId', val)}
                      disabled={loadingProviders}
                    >
                      <SelectTrigger id="tpl-server-provider" className="h-8 text-xs">
                        <SelectValue placeholder={loadingProviders ? 'Loading...' : 'Optional — fill in canvas'} />
                      </SelectTrigger>
                      <SelectContent>
                        {hetznerProviders.length > 0 ? (
                          hetznerProviders.map((p) => (
                            <SelectItem key={p.id} value={p.id.toString()} className="text-xs">
                              Hetzner ({p.name})
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled className="text-xs">
                            No Hetzner account connected
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="tpl-plan" className="text-xs">
                      Server Plan
                    </Label>
                    <Select value={form.data.plan} onValueChange={(val) => form.setData('plan', val)}>
                      <SelectTrigger id="tpl-plan" className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cx22" className="text-xs">
                          cx22 (2 vCPU, 4GB RAM)
                        </SelectItem>
                        <SelectItem value="cpx11" className="text-xs">
                          cpx11 (2 vCPU, 2GB RAM)
                        </SelectItem>
                        <SelectItem value="cpx21" className="text-xs">
                          cpx21 (3 vCPU, 4GB RAM)
                        </SelectItem>
                        <SelectItem value="cx32" className="text-xs">
                          cx32 (4 vCPU, 8GB RAM)
                        </SelectItem>
                        <SelectItem value="cax11" className="text-xs">
                          cax11 (ARM64 2 vCPU, 4GB)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="tpl-region" className="text-xs">
                      Location / Region
                    </Label>
                    <Select value={form.data.region} onValueChange={(val) => form.setData('region', val)}>
                      <SelectTrigger id="tpl-region" className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fsn1" className="text-xs">
                          Falkenstein (fsn1)
                        </SelectItem>
                        <SelectItem value="nbg1" className="text-xs">
                          Nuremberg (nbg1)
                        </SelectItem>
                        <SelectItem value="hel1" className="text-xs">
                          Helsinki (hel1)
                        </SelectItem>
                        <SelectItem value="ash" className="text-xs">
                          Ashburn (ash)
                        </SelectItem>
                        <SelectItem value="hil" className="text-xs">
                          Hillsboro (hil)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {}
              <div className="space-y-3 border-t pt-1">
                <div className="text-foreground flex items-center gap-1.5 pt-2 text-xs font-semibold tracking-wider uppercase">
                  <DatabaseIcon className="text-primary size-3.5" /> Database & PHP Stack
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="space-y-1">
                    <Label htmlFor="tpl-php" className="text-xs">
                      PHP Version
                    </Label>
                    <Select value={form.data.phpVersion} onValueChange={(val) => form.setData('phpVersion', val)}>
                      <SelectTrigger id="tpl-php" className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="8.4" className="text-xs">
                          PHP 8.4
                        </SelectItem>
                        <SelectItem value="8.3" className="text-xs">
                          PHP 8.3 (Recommended)
                        </SelectItem>
                        <SelectItem value="8.2" className="text-xs">
                          PHP 8.2
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="tpl-dbname" className="text-xs">
                      Database Name
                    </Label>
                    <Input
                      id="tpl-dbname"
                      value={form.data.dbName}
                      onChange={(e) => form.setData('dbName', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="tpl-dbuser" className="text-xs">
                      Database User
                    </Label>
                    <Input
                      id="tpl-dbuser"
                      value={form.data.dbUser}
                      onChange={(e) => form.setData('dbUser', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="tpl-dbpass" className="text-xs">
                        DB Password
                      </Label>
                      <button
                        type="button"
                        onClick={regeneratePassword}
                        className="text-primary flex items-center gap-0.5 text-[10px] hover:underline"
                      >
                        <RefreshCwIcon className="size-2.5" />
                        Gen
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="tpl-dbpass"
                        type="text"
                        value={form.data.dbPassword}
                        onChange={(e) => form.setData('dbPassword', e.target.value)}
                        className="h-8 pr-7 font-mono text-xs"
                      />
                      <KeyIcon className="text-muted-foreground absolute top-2 right-2 size-3.5" />
                    </div>
                  </div>
                </div>
              </div>

              {}
              <div className="space-y-2 border-t pt-1">
                <span className="text-foreground flex items-center gap-1.5 pt-2 text-xs font-semibold tracking-wider uppercase">
                  <CheckCircle2Icon className="text-primary size-3.5" /> Orchestration Pipeline ({selectedTemplate.steps.length} Steps)
                </span>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedTemplate.steps.map((step, idx) => (
                    <div key={idx} className="bg-card/60 flex items-start gap-2 rounded-lg border p-2 text-left">
                      <div className="bg-primary/10 text-primary flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-foreground truncate text-xs font-semibold">{step.title}</p>
                          {step.badge && (
                            <Badge variant="gray" className="shrink-0 px-1 py-0 text-[9px]">
                              {step.badge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground mt-0.5 line-clamp-1 text-[11px]">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </form>
          </div>
        </div>

        <DialogFooter className="bg-muted/20 border-t p-3 sm:px-5 sm:py-3">
          <div className="flex w-full items-center justify-between gap-2">
            <span className="text-muted-foreground hidden text-[11px] sm:inline">
              Opens directly in the visual workflow editor for node-level adjustments.
            </span>
            <div className="ml-auto flex items-center gap-2">
              <DialogClose asChild>
                <Button variant="ghost" size="sm" className="text-xs">
                  Cancel
                </Button>
              </DialogClose>
              <Button form="workflow-template-form" type="submit" size="sm" disabled={importForm.processing} className="text-xs">
                {importForm.processing ? <LoaderCircleIcon className="mr-1.5 size-3.5 animate-spin" /> : <SparklesIcon className="mr-1.5 size-3.5" />}
                Create Workflow
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
