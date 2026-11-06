import { useForm, usePage, router } from '@inertiajs/react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import InputError from '@/components/ui/input-error';
import { useDialog } from '@/hooks/use-dialog';
import { Server } from '@/types/server';
import { Site } from '@/types/site';

type Process = {
  id: number;
  label: string;
  driver: string;
  runtime_name: string;
  kind: string;
  status: string;
  status_label: string;
  last_checked_at: string | null;
  details: Record<string, string>;
  sites: Array<{ id: number; domain: string }>;
};

type Inventory = { processes: Process[]; sites: Array<{ id: number; domain: string }>; can_manage: boolean };

export default function RuntimeProcesses({ kind }: { kind?: 'worker' | 'scheduler' | 'service' }) {
  const { server, site } = usePage<{ server: Server; site?: Site }>().props;
  const dialog = useDialog();
  const [adding, setAdding] = useState(false);
  const form = useForm({ label: '', driver: 'systemd', runtime_name: '', kind: kind ?? 'service', site_ids: site ? [site.id] : [] as number[] });
  const base = `/servers/${server.id}/runtime-processes`;
  const inventory = useQuery({
    queryKey: ['runtime-processes', server.id, site?.id, kind],
    queryFn: async () => (await axios.get<Inventory>(`${base}/data`, { params: { site_id: site?.id, kind } })).data,
    refetchInterval: 15000,
  });

  function command(process: Process, operation: string) {
    dialog.confirm.open({
      title: `${operation[0].toUpperCase()}${operation.slice(1)} ${process.label}`,
      description: operation === 'unlink'
        ? 'Remove this panel connection only. The existing process will continue running.'
        : `This changes the existing ${process.driver} process on ${server.name}. All linked applications may be affected.`,
      method: operation === 'unlink' ? 'delete' : 'post',
      url: `${base}/${process.id}${operation === 'unlink' ? '' : `/${operation}`}`,
      variant: operation === 'stop' ? 'destructive' : 'default',
      onSuccess: () => { void inventory.refetch(); },
    });
  }

  return (
    <section className="space-y-4 rounded-lg border p-4" aria-label="Existing runtime processes">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Existing {kind === 'worker' ? 'workers' : kind === 'scheduler' ? 'schedulers' : kind === 'service' ? 'services' : 'runtime processes'}</h2>
          <p className="text-muted-foreground text-sm">Systemd, Docker and Supervisor connections. Registering a process preserves its existing configuration.</p>
          <p className="text-muted-foreground text-xs">Status is checked every two minutes. A masked process remains isolated.</p>
        </div>
        {inventory.data?.can_manage && <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => router.post(`${base}/refresh`, {}, { preserveScroll: true })}>Refresh status</Button>
          <Button size="sm" variant="outline" onClick={() => setAdding(!adding)}>Register existing</Button>
        </div>}
      </div>
      {inventory.isPending && <p role="status">Loading processes…</p>}
      {inventory.isError && <div role="alert"><p>Process inventory could not be loaded.</p><Button variant="outline" onClick={() => void inventory.refetch()}>Retry</Button></div>}
      {adding && <form className="space-y-3 rounded-md border p-4" onSubmit={(event) => {
        event.preventDefault();
        form.post(base, { preserveScroll: true, onSuccess: () => { setAdding(false); form.reset(); void inventory.refetch(); } });
      }}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1"><Label htmlFor="runtime-label">Display name</Label><Input id="runtime-label" required value={form.data.label} onChange={(event) => form.setData('label', event.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="runtime-name">Existing unit or container name</Label><Input id="runtime-name" required placeholder="example-worker.service" value={form.data.runtime_name} onChange={(event) => form.setData('runtime_name', event.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="runtime-driver">Process manager</Label><select id="runtime-driver" className="bg-background w-full rounded-md border p-2" value={form.data.driver} onChange={(event) => form.setData('driver', event.target.value)}><option value="systemd">Systemd</option><option value="docker">Docker</option><option value="supervisor">Supervisor</option></select></div>
          <div className="space-y-1"><Label htmlFor="runtime-kind">Purpose</Label><select id="runtime-kind" className="bg-background w-full rounded-md border p-2" value={form.data.kind} onChange={(event) => form.setData('kind', event.target.value as typeof form.data.kind)}><option value="worker">Worker</option><option value="scheduler">Scheduler</option><option value="service">Service</option></select></div>
        </div>
        <fieldset className="space-y-2"><legend className="text-sm font-medium">Linked applications</legend><div className="flex flex-wrap gap-3">{inventory.data?.sites.map((application) => <label key={application.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.data.site_ids.includes(application.id)} onChange={(event) => form.setData('site_ids', event.target.checked ? [...form.data.site_ids, application.id] : form.data.site_ids.filter((id) => id !== application.id))} />{application.domain}</label>)}</div></fieldset>
        {Object.entries(form.errors).map(([field, error]) => <InputError key={field} message={error} />)}
        <Button disabled={form.processing}>Register connection</Button>
      </form>}
      {inventory.data?.processes.length === 0 && <p className="text-muted-foreground text-sm">No existing processes linked here yet. Register the exact existing unit or container name to track it.</p>}
      <div className="space-y-3">{inventory.data?.processes.map((process) => <article key={process.id} className="space-y-2 rounded-md border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{process.label}</h3><span className={`rounded px-2 py-1 text-xs ${process.status === 'running' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : process.status === 'failed' ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'}`}>{process.status_label}</span></div>
        <p className="text-muted-foreground break-all text-xs">{process.driver} · {process.kind} · {process.runtime_name}</p>
        <p className="text-muted-foreground text-xs">{process.sites.map((application) => application.domain).join(', ') || 'Server-wide'} · Checked: {process.last_checked_at ? new Date(process.last_checked_at).toLocaleString() : 'Pending'}</p>
        {(process.details.error || process.details.command_result) && <p role="status" className="text-sm">{process.details.error || process.details.command_result}</p>}
        {inventory.data?.can_manage && <div className="flex flex-wrap gap-2">{['start', 'stop', 'restart', 'unlink'].map((operation) => <Button key={operation} size="sm" variant="outline" disabled={process.status === 'masked' && operation !== 'unlink'} onClick={() => command(process, operation)}>{operation[0].toUpperCase() + operation.slice(1)}</Button>)}</div>}
      </article>)}</div>
    </section>
  );
}
