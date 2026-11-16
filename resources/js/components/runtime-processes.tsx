import { useTranslate } from '@/hooks/use-translate';
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
  unix_user: string;
  runtime_name: string;
  kind: string;
  status: string;
  status_label: string;
  last_checked_at: string | null;
  details: Record<string, string>;
  sites: Array<{ id: number; domain: string }>;
};

type Inventory = { processes: Process[]; sites: Array<{ id: number; domain: string }>; can_manage: boolean; isolated_users: string[] };

const driverLabels: Record<string, string> = { systemd: 'Systemd', docker: 'Docker', supervisor: 'Supervisor', systemd_user: 'Systemd (user)', rootless_docker: 'Docker (rootless)' };

export default function RuntimeProcesses({ kind }: { kind?: 'worker' | 'scheduler' | 'service' }) {
  const translateText = useTranslate();
  const { server, site } = usePage<{ server: Server; site?: Site }>().props;
  const dialog = useDialog();
  const [adding, setAdding] = useState(false);
  const form = useForm({ label: '', driver: 'systemd', unix_user: '', runtime_name: '', kind: kind ?? 'service', site_ids: site ? [site.id] : [] as number[] });
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
        : `This changes the existing ${driverLabels[process.driver] ?? process.driver} process${process.unix_user ? ` for ${process.unix_user}` : ''} on ${server.name}. All linked applications may be affected.`,
      method: operation === 'unlink' ? 'delete' : 'post',
      url: `${base}/${process.id}${operation === 'unlink' ? '' : `/${operation}`}`,
      variant: operation === 'stop' ? 'destructive' : 'default',
      onSuccess: () => { void inventory.refetch(); },
    });
  }

  return (
    <section className="space-y-4 rounded-lg border p-4" aria-label={translateText("Existing runtime processes")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{translateText("Existing")} {kind === 'worker' ? translateText("workers") : kind === 'scheduler' ? translateText("schedulers") : kind === 'service' ? translateText("services") : translateText("runtime processes")}</h2>
          <p className="text-muted-foreground text-sm">{translateText("Systemd, Docker and Supervisor connections, including user services and rootless containers. Registering a process preserves its existing configuration.")}</p>
          <p className="text-muted-foreground text-xs">{translateText("Status is checked every two minutes. A masked process remains isolated.")}</p>
        </div>
        {inventory.data?.can_manage && <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => router.post(`${base}/refresh`, {}, { preserveScroll: true })}>{translateText("Refresh status")}</Button>
          <Button size="sm" variant="outline" onClick={() => setAdding(!adding)}>{translateText("Register existing")}</Button>
        </div>}
      </div>
      {inventory.isPending && <p role="status">{translateText("Loading processes…")}</p>}
      {inventory.isError && <div role="alert"><p>{translateText("Process inventory could not be loaded.")}</p><Button variant="outline" onClick={() => void inventory.refetch()}>{translateText('Retry')}</Button></div>}
      {adding && <form className="space-y-3 rounded-md border p-4" onSubmit={(event) => {
        event.preventDefault();
        form.post(base, { preserveScroll: true, onSuccess: () => { setAdding(false); form.reset(); void inventory.refetch(); } });
      }}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1"><Label htmlFor="runtime-label">{translateText("Display name")}</Label><Input id="runtime-label" required value={form.data.label} onChange={(event) => form.setData('label', event.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="runtime-name">{translateText("Existing unit or container name")}</Label><Input id="runtime-name" required placeholder={form.data.driver.includes('docker') ? 'container-name' : 'example-worker.service'} value={form.data.runtime_name} onChange={(event) => form.setData('runtime_name', event.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="runtime-driver">{translateText("Process manager")}</Label><select id="runtime-driver" className="bg-background w-full rounded-md border p-2" value={form.data.driver} onChange={(event) => { const driver = event.target.value; form.setData((data) => ({ ...data, driver, unix_user: '' })); }}>{Object.entries(driverLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          {['systemd_user', 'rootless_docker'].includes(form.data.driver) && <div className="space-y-1">
            <Label htmlFor="runtime-user">{translateText("Linux user")}</Label>
            <select id="runtime-user" required className="bg-background w-full rounded-md border p-2" value={form.data.unix_user} onChange={(event) => form.setData('unix_user', event.target.value)}>
              <option value="">{translateText("Select a registered user")}</option>
              {(inventory.data?.isolated_users ?? []).map((user) => <option key={user} value={user}>{user}</option>)}
            </select>
            <p className="text-muted-foreground text-xs">{translateText("Connects to this user's service manager or rootless Docker daemon.")}</p>
            {inventory.data?.isolated_users?.length === 0 && <p role="status" className="text-muted-foreground text-xs">{translateText("Register an isolated Linux user on this server first.")}</p>}
          </div>}
          <div className="space-y-1"><Label htmlFor="runtime-kind">{translateText("Purpose")}</Label><select id="runtime-kind" className="bg-background w-full rounded-md border p-2" value={form.data.kind} onChange={(event) => form.setData('kind', event.target.value as typeof form.data.kind)}><option value="worker">Worker</option><option value="scheduler">Scheduler</option><option value="service">{translateText('Service')}</option></select></div>
        </div>
        <fieldset className="space-y-2"><legend className="text-sm font-medium">{translateText("Linked applications")}</legend><div className="flex flex-wrap gap-3">{inventory.data?.sites.map((application) => <label key={application.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.data.site_ids.includes(application.id)} onChange={(event) => form.setData('site_ids', event.target.checked ? [...form.data.site_ids, application.id] : form.data.site_ids.filter((id) => id !== application.id))} />{application.domain}</label>)}</div></fieldset>
        {Object.entries(form.errors).map(([field, error]) => <InputError key={field} message={error} />)}
        <Button disabled={form.processing}>{translateText("Register connection")}</Button>
      </form>}
      {inventory.data?.processes.length === 0 && <p className="text-muted-foreground text-sm">{translateText("No existing processes linked here yet. Register the exact existing unit or container name to track it.")}</p>}
      <div className="space-y-3">{inventory.data?.processes.map((process) => <article key={process.id} className="space-y-2 rounded-md border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{process.label}</h3><span className={`rounded px-2 py-1 text-xs ${process.status === 'running' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : process.status === 'failed' ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'}`}>{process.status_label}</span></div>
        <p className="text-muted-foreground break-all text-xs">{driverLabels[process.driver] ?? process.driver}{process.unix_user ? ` · ${process.unix_user}` : ''} · {process.kind} · {process.runtime_name}</p>
        <p className="text-muted-foreground text-xs">{process.sites.map((application) => application.domain).join(', ') || translateText("Server-wide")} {translateText("· Checked:")} {process.last_checked_at ? new Date(process.last_checked_at).toLocaleString() : translateText("Pending")}</p>
        {(process.details.error || process.details.command_result) && <p role="status" className="text-sm">{process.details.error || process.details.command_result}</p>}
        {inventory.data?.can_manage && <div className="flex flex-wrap gap-2">{['start', 'stop', 'restart', 'unlink'].map((operation) => <Button key={operation} size="sm" variant="outline" disabled={process.status === 'masked' && operation !== 'unlink'} onClick={() => command(process, operation)}>{operation[0].toUpperCase() + operation.slice(1)}</Button>)}</div>}
      </article>)}</div>
    </section>
  );
}
