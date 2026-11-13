import { useTranslate } from '@/hooks/use-translate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CiRunner } from '@/types/ci';
import { router } from '@inertiajs/react';
import axios from 'axios';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { ciError } from '../ci-error';

export default function RunnerSettings({ base, runner, servers, repository }: {
  base: string;
  runner: CiRunner | null;
  servers: { id: number; name: string }[];
  repository: string | null;
}) {
  const translateText = useTranslate();
  const [serverId, setServerId] = useState(String(runner?.server_id ?? ''));
  const [user, setUser] = useState(runner?.user ?? 'vito-ci');
  const [executable, setExecutable] = useState(runner?.executable ?? '/usr/local/bin/vito-ci');
  const [enabled, setEnabled] = useState(runner?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await axios.post(`${base}/settings`, { server_id: Number(serverId), user, executable, enabled });
      toast.success('CI runner connected.');
      router.reload({ only: ['runner'] });
    } catch (failure) {
      setError(ciError(failure));
    } finally {
      setSaving(false);
    }
  }

  return <details className="rounded-xl border bg-card p-4" open={!runner}>
    <summary className="cursor-pointer font-medium">{translateText("Runner settings")}</summary>
    <p className="mt-3 text-sm text-muted-foreground">{translateText("Connect an existing isolated runner for")} {repository || translateText("this repository")}{translateText(". This does not install software or change the application.")}</p>
    <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="ci-server">{translateText("Runner server")}</Label>
        <select id="ci-server" value={serverId} onChange={(event) => setServerId(event.target.value)} required className="h-9 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">{translateText("Select a runner server")}</option>
          {servers.map((server) => <option key={server.id} value={server.id}>{server.name}</option>)}
        </select>
      </div>
      <div className="space-y-2"><Label htmlFor="ci-user">{translateText("Isolated Linux user")}</Label><Input id="ci-user" value={user} onChange={(event) => setUser(event.target.value)} required maxLength={32} autoComplete="off" /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="ci-executable">{translateText("Runner client path")}</Label><Input id="ci-executable" value={executable} onChange={(event) => setExecutable(event.target.value)} required maxLength={255} autoComplete="off" /><p className="text-xs text-muted-foreground">{translateText("Use the administrator-installed, root-owned CI client. Repository identity is checked before saving.")}</p></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />{translateText("Enable CI requests")}</label>
      {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2"><Button type="submit" disabled={saving || !repository || !serverId}>{saving ? translateText("Checking runner…") : translateText("Verify and save")}</Button></div>
    </form>
  </details>;
}
