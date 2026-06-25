import { Button } from '@/components/ui/button';
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
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ServerProvider } from '@/types/server-provider';
import { Workflow } from '@/types/workflow';
import { useForm, usePage } from '@inertiajs/react';
import { LoaderCircleIcon } from 'lucide-react';
import { FormEvent, ReactNode, useState } from 'react';
import { useInputFocus } from '@/stores/useInputFocus';
import HetznerPlanSelect from './hetzner-plan-select';
import HetznerRegionSelect from './hetzner-region-select';

type WorkflowInputValue = string | number | boolean | string[] | null;

export default function Run({ workflow, children }: { workflow: Workflow; children: ReactNode }) {
  const page = usePage<{ serverProviders?: ServerProvider[] }>();
  const setFocused = useInputFocus((state) => state.setFocused);
  const [open, setOpen] = useState(false);
  const serverProviders = page.props.serverProviders || [];
  const workflowName = (() => {
    try {
      return decodeURIComponent(workflow.name);
    } catch {
      return workflow.name;
    }
  })();

  const normalizedInputs = Object.fromEntries(
    Object.entries(workflow.run_inputs || {}).map(([key, value]) => {
      if (key === 'os') return [key, 'ubuntu_24'];
      if (typeof value !== 'string') return [key, value];

      try {
        return [key, decodeURIComponent(value)];
      } catch {
        return [key, value];
      }
    }),
  ) as Record<string, WorkflowInputValue>;

  const form = useForm<{
    inputs: Record<string, WorkflowInputValue>;
    verbose: boolean;
  }>({
    inputs: normalizedInputs,
    verbose: false,
  });

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    setFocused(isOpen);
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    form.post(route('workflow-runs.store', { workflow: workflow.id }));
  };

  const setInput = (key: string, value: WorkflowInputValue) => {
    form.setData('inputs', {
      ...form.data.inputs,
      [key]: value,
    });
  };

  const setServerProvider = (id: string) => {
    const serverProvider = serverProviders.find((provider) => provider.id.toString() === id);

    form.setData('inputs', {
      ...form.data.inputs,
      server_provider: Number(id),
      provider: serverProvider?.provider || form.data.inputs.provider,
    });
  };

  const renderField = (key: string, value: WorkflowInputValue) => {
    if (key === 'server_provider') {
      return (
        <FormField key={key}>
          <Label>Server Provider</Label>
          <Select value={value?.toString() || ''} onValueChange={setServerProvider}>
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
        </FormField>
      );
    }

    if (key === 'provider') {
      return (
        <FormField key={key}>
          <Label>Provider</Label>
          <Select value={value?.toString() || ''} onValueChange={(selected) => setInput(key, selected)}>
            <SelectTrigger>
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              {['hetzner', 'digitalocean', 'aws', 'vultr', 'linode'].map((provider) => (
                <SelectItem key={provider} value={provider}>
                  {provider}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      );
    }

    if (key === 'os') {
      return (
        <FormField key={key}>
          <Label>Operating System</Label>
          <Input value="ubuntu_24" readOnly />
        </FormField>
      );
    }

    if (key === 'plan' && form.data.inputs.provider === 'hetzner') {
      return (
        <FormField key={key}>
          <Label>Hetzner Plan</Label>
          <HetznerPlanSelect value={value?.toString() || ''} onChange={(selected) => setInput(key, selected)} />
        </FormField>
      );
    }

    if (key === 'region' && form.data.inputs.provider === 'hetzner') {
      return (
        <FormField key={key}>
          <Label>Hetzner Region</Label>
          <HetznerRegionSelect value={value?.toString() || ''} onChange={(selected) => setInput(key, selected)} />
        </FormField>
      );
    }

    return (
      <FormField key={key}>
        <Label htmlFor={`workflow-input-${key}`}>{key}</Label>
        <Input id={`workflow-input-${key}`} value={value?.toString() || ''} onChange={(event) => setInput(key, event.target.value)} />
      </FormField>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Run workflow [{workflowName}]</DialogTitle>
          <DialogDescription className="sr-only">Run workflow [{workflowName}]</DialogDescription>
        </DialogHeader>
        <Form id="run-workflow-form" onSubmit={submit} className="p-4">
          <FormFields>
            {Object.entries(form.data.inputs).map(([key, value]) => renderField(key, value))}
            <FormField>
              <Label htmlFor="verbose">Verbose Output</Label>
              <Switch id="verbose" checked={form.data.verbose} onCheckedChange={(checked) => form.setData('verbose', checked)} />
            </FormField>
          </FormFields>
        </Form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
          <Button type="submit" form="run-workflow-form" disabled={form.processing}>
            {form.processing && <LoaderCircleIcon className="animate-spin" />}
            Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
