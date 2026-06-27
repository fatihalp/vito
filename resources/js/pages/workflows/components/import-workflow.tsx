import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ServerProvider } from '@/types/server-provider';
import { SourceControl } from '@/types/source-control';
import { router } from '@inertiajs/react';
import { type RequestPayload } from '@inertiajs/core';
import { type Edge, type Node } from '@xyflow/react';
import axios from 'axios';
import { LoaderCircle } from 'lucide-react';
import { FormEvent, MouseEvent, ReactNode, useEffect, useState } from 'react';
import { toast } from 'sonner';
import SelectRepo from '@/pages/source-controls/components/select-repo';
import { defaultHetznerPlan, getHetznerPlan } from '../hetzner-plans';
import HetznerPlanSelect from './hetzner-plan-select';
import { defaultHetznerRegion, getHetznerRegion } from '../hetzner-regions';
import HetznerRegionSelect from './hetzner-region-select';

type WorkflowImport = {
  name?: string;
  site_addresses?: string[];
  domains?: string[];
  nodes: Node[];
  edges: Edge[];
};

type ImportForm = {
  name: string;
  nodes: Node[];
  edges: Edge[];
};

type WorkflowNodeAction = {
  inputs?: Record<string, unknown>;
  [key: string]: unknown;
};

export default function ImportWorkflow({
  children,
  serverProviders,
  sourceControls,
}: {
  children: ReactNode;
  serverProviders: ServerProvider[];
  sourceControls: SourceControl[];
}) {
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState('');
  const [serverProvider, setServerProvider] = useState('');
  const [plan, setPlan] = useState(defaultHetznerPlan);
  const [region, setRegion] = useState(defaultHetznerRegion);
  const [sourceControl, setSourceControl] = useState('');
  const [repository, setRepository] = useState('');
  const [domainOptions, setDomainOptions] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [detectingRegion, setDetectingRegion] = useState(false);
  const [isPlanFromFile, setIsPlanFromFile] = useState(false);
  const [bestRegionLatency, setBestRegionLatency] = useState<number | null>(null);
  const [isRegionAutoDetected, setIsRegionAutoDetected] = useState(false);
  const [isRegionFromFile, setIsRegionFromFile] = useState(false);
  const [sourceControlsList, setSourceControlsList] = useState<SourceControl[]>(sourceControls);

  useEffect(() => {
    setSourceControlsList(sourceControls);
  }, [sourceControls]);

  useEffect(() => {
    if (!open) return;

    setDetectingRegion(true);
    setIsRegionAutoDetected(false);
    setBestRegionLatency(null);
    setIsPlanFromFile(false);
    setIsRegionFromFile(false);
    setFile(null);
    setDomainOptions([]);
    setDomain('');
    setRepository('');
    setSourceControl('');
    setServerProvider('');
    setPlan(defaultHetznerPlan);
    setRegion(defaultHetznerRegion);

    axios.get<{ latencies: Record<string, number | null> }>(route('hetzner.latency'))
      .then((response) => {
        const measured = Object.entries(response.data.latencies)
          .filter((entry): entry is [string, number] => typeof entry[1] === 'number');
        const bestEntry = measured.sort((a, b) => a[1] - b[1])[0];
        if (bestEntry) {
          const [bestRegionCode, latency] = bestEntry;
          setRegion(bestRegionCode);
          setBestRegionLatency(latency);
          setIsRegionAutoDetected(true);
        }
      })
      .catch((err) => {
        console.error('Failed to auto-detect region', err);
      })
      .finally(() => {
        setDetectingRegion(false);
      });
  }, [open]);

  const normalizeDomain = (value: string) => {
    const withProtocol = value.match(/^https?:\/\//) ? value : `https://${value}`;
    const hostname = new URL(withProtocol).hostname.replace(/^www\./, '').toLowerCase();

    if (!/^[a-z0-9.-]+$/.test(hostname)) {
      throw new Error('Invalid domain');
    }

    return hostname;
  };

  const replaceTokens = (value: unknown, tokens: Record<string, string>): unknown => {
    if (typeof value === 'string') {
      return Object.entries(tokens).reduce((text, [token, replacement]) => text.replaceAll(token, replacement), value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => replaceTokens(item, tokens));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceTokens(item, tokens)]));
    }

    return value;
  };

  const getActionInputs = (workflow: WorkflowImport, handler: string) => {
    const node = workflow.nodes.find((node) => {
      const action = node.data?.action as WorkflowNodeAction | undefined;

      return action?.handler === handler;
    });
    const action = node?.data?.action as WorkflowNodeAction | undefined;

    return action?.inputs && typeof action.inputs === 'object' ? action.inputs : {};
  };

  const normalizeRepository = (value: string) => {
    const repository = value.trim();

    if (!/^[^\s/]+\/[^\s/]+$/.test(repository)) {
      throw new Error('Invalid repository');
    }

    return repository;
  };

  const uniqueDomains = (values: unknown) => {
    if (!Array.isArray(values)) return [];

    return [...new Set(values.map((value) => value?.toString() || '').filter(Boolean))]
      .map((value) => {
        try {
          return normalizeDomain(value);
        } catch {
          return '';
        }
      })
      .filter(Boolean);
  };

  const applyTemplateDefaults = async (selectedFile: File | null) => {
    setFile(selectedFile);
    setDomainOptions([]);
    if (!selectedFile) return;

    try {
      const template = JSON.parse(await selectedFile.text()) as WorkflowImport;
      if (!Array.isArray(template.nodes) || !Array.isArray(template.edges)) {
        toast.error('Invalid workflow JSON file.');
        return;
      }

      const serverInputs = getActionInputs(template, 'App\\WorkflowActions\\Server\\CreateServer');
      const siteInputs = getActionInputs(template, 'App\\WorkflowActions\\Site\\CreateLaravelSite');
      const filePlan = serverInputs.plan?.toString();
      const fileRegion = serverInputs.region?.toString();
      const fileProviderId = serverInputs.server_provider?.toString();
      const fileProvider = serverInputs.provider?.toString();
      const fileSourceControl = siteInputs.source_control?.toString();
      const fileRepository = siteInputs.repository?.toString();
      const fileDomain = siteInputs.domain?.toString();
      const fileDomains = uniqueDomains(template.site_addresses || template.domains);

      if (filePlan && getHetznerPlan(filePlan)) {
        setPlan(filePlan);
        setIsPlanFromFile(true);
      } else {
        setIsPlanFromFile(false);
      }
      if (fileRegion && getHetznerRegion(fileRegion)) {
        setRegion(fileRegion);
        setIsRegionFromFile(true);
        setIsRegionAutoDetected(false);
        setBestRegionLatency(null);
      } else {
        setIsRegionFromFile(false);
      }
      if (fileProviderId && serverProviders.some((provider) => provider.id.toString() === fileProviderId)) {
        setServerProvider(fileProviderId);
      } else if (fileProvider) {
        const matchedProviders = serverProviders.filter((provider) => provider.provider === fileProvider);
        if (matchedProviders.length === 1) {
          setServerProvider(matchedProviders[0].id.toString());
        }
      }
      if (fileSourceControl) {
        if (fileSourceControl.startsWith('ghp_')) {
          try {
            const response = await axios.post<{ id: number; sourceControls: SourceControl[] }>(
              route('source-controls.match'),
              { token: fileSourceControl }
            );
            setSourceControlsList(response.data.sourceControls);
            setSourceControl(response.data.id.toString());
          } catch (e) {
            console.error('Failed to match/connect source control', e);
          }
        } else if (sourceControlsList.some((sc) => sc.id.toString() === fileSourceControl)) {
          setSourceControl(fileSourceControl);
        }
      }
      if (fileRepository && !fileRepository.includes('__')) {
        setRepository(fileRepository);
      }
      if (fileDomains.length > 0) {
        setDomainOptions(fileDomains);
        setDomain(fileDomains[0]);
      }
      if (fileDomain && !fileDomain.includes('__')) {
        setDomain(fileDomain);
      }
    } catch {
      toast.error('Could not read workflow JSON defaults.');
    }
  };

  const buildWorkflow = async (): Promise<ImportForm | null> => {
    if (!file) {
      toast.error('Select a workflow JSON file.');
      return null;
    }
    if (!serverProvider) {
      toast.error('Select a server provider.');
      return null;
    }
    if (!plan) {
      toast.error('Select a Hetzner plan.');
      return null;
    }
    if (!region) {
      toast.error('Select a Hetzner region.');
      return null;
    }
    if (!sourceControl) {
      toast.error('Select a source control.');
      return null;
    }

    let normalizedRepository: string;
    try {
      normalizedRepository = normalizeRepository(repository);
    } catch {
      toast.error('Select a valid repository.');
      return null;
    }

    let normalizedDomain: string;
    try {
      normalizedDomain = normalizeDomain(domain);
    } catch {
      toast.error('Enter a valid site address.');
      return null;
    }

    const baseName = normalizedDomain.split('.')[0] || 'site';
    const siteUser = normalizedDomain
      .replace(/[^a-z0-9]/g, '')
      .replace(/^[^a-z]+/, '')
      .slice(0, 32);
    const databaseName = baseName.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 63);
    const appName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
    const databasePassword = Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) => byte.toString(36))
      .join('')
      .slice(0, 32);

    try {
      const template = JSON.parse(await file.text()) as WorkflowImport;
      const imported = replaceTokens(template, {
        '__DOMAIN__': normalizedDomain,
        '__APP_URL__': `https://${normalizedDomain}`,
        '__APP_NAME__': appName,
        '__SITE_USER__': siteUser,
        '__DATABASE_NAME__': databaseName,
        '__DATABASE_USERNAME__': databaseName,
        '__DATABASE_PASSWORD__': databasePassword,
      }) as WorkflowImport;

      if (!Array.isArray(imported.nodes) || !Array.isArray(imported.edges)) {
        toast.error('Invalid workflow JSON file.');
        return null;
      }

      imported.nodes = imported.nodes.map((node, index) => {
        const action = node.data?.action as WorkflowNodeAction | undefined;
        const inputs = action?.inputs;
        const nodeWithPosition = {
          ...node,
          position: node.position || { x: index * 360, y: 0 },
        };

        if (inputs && typeof inputs === 'object' && action?.handler === 'App\\WorkflowActions\\Server\\CreateServer') {
          return {
            ...nodeWithPosition,
            data: {
              ...node.data,
              action: {
                ...action,
                inputs: {
                  ...inputs,
                  plan,
                  region,
                  server_provider: Number(serverProvider),
                },
              },
            },
          };
        }

        if (inputs && typeof inputs === 'object' && action?.handler === 'App\\WorkflowActions\\Site\\CreateLaravelSite') {
          return {
            ...nodeWithPosition,
            data: {
              ...node.data,
              action: {
                ...action,
                inputs: {
                  ...inputs,
                  domain: normalizedDomain,
                  repository: normalizedRepository,
                  source_control: Number(sourceControl),
                },
              },
            },
          };
        }

        return nodeWithPosition;
      });

      return {
        name: imported.name || `${normalizedDomain} Laravel Provision`,
        nodes: imported.nodes,
        edges: imported.edges,
      };
    } catch {
      toast.error('Could not import workflow JSON.');
      return null;
    }
  };

  const submit = async (event: FormEvent | MouseEvent) => {
    event.preventDefault();
    const workflow = await buildWorkflow();
    if (!workflow) return;

    setProcessing(true);
    router.post(route('workflows.store'), workflow as unknown as RequestPayload, {
      onSuccess: () => {
        setOpen(false);
      },
      onFinish: () => setProcessing(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Workflow</DialogTitle>
          <DialogDescription>Enter the site address and select a workflow JSON template.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 p-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="workflow-import-file">Workflow JSON</Label>
            <Input
              id="workflow-import-file"
              type="file"
              accept="application/json,.json"
              onChange={(event) => void applyTemplateDefaults(event.target.files?.[0] ?? null)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="workflow-import-domain">Site Address</Label>
            {domainOptions.length > 0 ? (
              <Select value={domain} onValueChange={setDomain}>
                <SelectTrigger id="workflow-import-domain">
                  <SelectValue placeholder="Select site address" />
                </SelectTrigger>
                <SelectContent searchable>
                  {domainOptions.map((domain) => (
                    <SelectItem key={domain} value={domain}>
                      {domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input id="workflow-import-domain" value={domain} placeholder="alobot.net" onChange={(event) => setDomain(event.target.value)} />
            )}
          </div>
          <div className="grid gap-2">
            <Label>Server Provider</Label>
            <Select value={serverProvider} onValueChange={setServerProvider}>
              <SelectTrigger>
                <SelectValue placeholder="Select server provider" />
              </SelectTrigger>
              <SelectContent searchable>
                {serverProviders.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id.toString()}>
                    {provider.name} ({provider.provider})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Hetzner Plan</Label>
              {isPlanFromFile && (
                <span className="text-green-600 dark:text-green-400 text-xs font-medium">Json plan selected.</span>
              )}
            </div>
            <HetznerPlanSelect
              value={plan}
              onChange={(value) => {
                setPlan(value);
                setIsPlanFromFile(false);
              }}
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Hetzner Region</Label>
              {detectingRegion && (
                <span className="text-muted-foreground animate-pulse text-xs">Detecting best region...</span>
              )}
              {isRegionAutoDetected && bestRegionLatency !== null && (
                <span className="text-green-600 dark:text-green-400 text-xs font-medium">
                  Best region detected and selected ({bestRegionLatency} ms)
                </span>
              )}
              {isRegionFromFile && (
                <span className="text-green-600 dark:text-green-400 text-xs font-medium">
                  Json region selected.
                </span>
              )}
            </div>
            <HetznerRegionSelect
              value={region}
              onChange={(value) => {
                setRegion(value);
                setIsRegionAutoDetected(false);
                setIsRegionFromFile(false);
                setBestRegionLatency(null);
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label>Source Control</Label>
            <Select
              value={sourceControl}
              onValueChange={(value) => {
                setSourceControl(value);
                setRepository('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select source control" />
              </SelectTrigger>
              <SelectContent searchable>
                {sourceControlsList.map((sourceControl) => (
                  <SelectItem key={sourceControl.id} value={sourceControl.id.toString()}>
                    {sourceControl.name} ({sourceControl.provider})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="workflow-import-repository">Repository</Label>
            <SelectRepo sourceControlId={sourceControl} value={repository} onValueChange={setRepository} placeholder="owner/repository" />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={processing}>
            {processing && <LoaderCircle className="animate-spin" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
