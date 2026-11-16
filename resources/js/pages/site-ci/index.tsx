import { useTranslate } from '@/hooks/use-translate';
import Container from '@/components/container';
import Heading from '@/components/heading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ServerLayout from '@/layouts/server/layout';
import type { CiRun, CiRunner } from '@/types/ci';
import type { Server } from '@/types/server';
import type { Site } from '@/types/site';
import { Head, usePage } from '@inertiajs/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { ciError } from './ci-error';
import RunnerSettings from './components/runner-settings';
import { useCiLog } from './use-ci-log';

type CiData = { runs: CiRun[]; stages: string[] };

function statusLabel(value: string) {
  return ({ queued: 'Queued', running: 'Running', passed: 'Passed', failed: 'Checks failed', infrastructure_error: 'Infrastructure error', cancelled: 'Cancelled', skipped: 'Skipped' } as Record<string, string>)[value] ?? value;
}

export default function SiteCi() {
  return <ServerLayout><SiteCiContent /></ServerLayout>;
}

function SiteCiContent() {
  const translateText = useTranslate();
  const { server, site, runner, canConfigure, canRun, runnerServers } = usePage<{
    server: Server;
    site: Site;
    runner: CiRunner | null;
    canConfigure: boolean;
    canRun: boolean;
    runnerServers: { id: number; name: string }[];
  }>().props;
  const base = `/servers/${server.id}/sites/${site.id}/ci`;
  const key = ['site-ci', server.id, site.id, runner?.enabled, runner?.server_id, runner?.repository];
  const cache = useQueryClient();
  const [ref, setRef] = useState(site.branch || 'main');
  const [all, setAll] = useState(true);
  const [chosen, setChosen] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stage, setStage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const response = await axios.get<CiData>(`${base}/data`, { signal });
      if (!Array.isArray(response.data.runs) || !Array.isArray(response.data.stages)) throw new Error('Invalid CI response');
      return response.data;
    },
    enabled: Boolean(runner),
    refetchInterval: 5000,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 2000,
  });
  const runs = query.data?.runs ?? [];
  const selected = runs.find((run) => run.run_id === selectedId) ?? runs[0] ?? null;
  const active = selected ? ['queued', 'running'].includes(selected.status) : false;
  const busy = runs.some((run) => ['queued', 'running'].includes(run.status));
  const log = useCiLog(base, selected?.run_id ?? null, stage, active, Boolean(runner));

  async function start(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setActionError(null);
    try {
      const stages = all ? query.data?.stages ?? [] : chosen;
      const response = await axios.post<{ run: CiRun }>(`${base}/run`, { ref, stages });
      const run = response.data.run;
      cache.setQueryData<CiData>(key, (previous) => ({ runs: [run, ...(previous?.runs ?? []).filter((item) => item.run_id !== run.run_id)], stages: previous?.stages ?? [] }));
      setSelectedId(run.run_id);
      setStage('');
      toast.success('CI job submitted. It runs on the isolated runner.');
    } catch (failure) {
      setActionError(ciError(failure));
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel() {
    if (!selected) return;
    setCancelling(true);
    setActionError(null);
    try {
      const response = await axios.post<{ cancel_requested: boolean }>(`${base}/${selected.run_id}/cancel`);
      toast.info(response.data.cancel_requested ? 'Cancellation requested. Waiting for cleanup.' : 'This job is no longer running.');
      await query.refetch();
    } catch (failure) {
      setActionError(ciError(failure));
    } finally {
      setCancelling(false);
    }
  }

  return <><Head title="CI" /><Container>
    <Heading title="CI" description={translateText("Run repository checks on an isolated server and follow their results. CI does not deploy your application.")} />
    {canConfigure && <RunnerSettings base={base} runner={runner} servers={runnerServers} repository={site.repository} />}
    {!runner && <Alert><AlertDescription>{translateText("No CI runner is connected.")} {canConfigure ? translateText("Connect an isolated runner above.") : translateText("Ask an administrator to connect a runner for this repository.")}</AlertDescription></Alert>}
    {runner && <p className="text-sm text-muted-foreground">Runner: {runner.server_name} · {runner.repository}</p>}
    {runner && !runner.enabled && <Alert><AlertDescription>{translateText("CI is paused. Existing jobs are not cancelled by pausing this connection.")}</AlertDescription></Alert>}
    {query.isError && <Alert variant="destructive"><AlertDescription>{ciError(query.error)} <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>{translateText('Retry')}</Button></AlertDescription></Alert>}
    {runner?.enabled && canRun && <form onSubmit={start} className="space-y-3 rounded-xl border bg-card p-4">
      <Label htmlFor="ci-ref">{translateText("Branch, PR or commit")}</Label>
      <div className="flex flex-col gap-2 sm:flex-row"><Input id="ci-ref" value={ref} onChange={(event) => setRef(event.target.value)} placeholder={translateText("main, pr:47 or a full commit SHA")} maxLength={200} required autoComplete="off" /><Button type="submit" disabled={submitting || busy || !query.isSuccess || !ref.trim() || (!all && chosen.length === 0)}>{submitting ? translateText("Submitting…") : translateText("Run CI")}</Button></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={all} onChange={(event) => setAll(event.target.checked)} />{translateText("Run all available stages")}</label>
      {!all && <fieldset className="flex flex-wrap gap-4"><legend className="mb-2 text-sm">{translateText("Choose stages")}</legend>{query.data?.stages.map((name) => <label key={name} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={chosen.includes(name)} onChange={(event) => setChosen((previous) => event.target.checked ? [...previous, name] : previous.filter((value) => value !== name))} />{name}</label>)}</fieldset>}
      <p className="text-xs text-muted-foreground">{translateText("Prerequisites are included automatically. One job runs at a time.")}{busy ? translateText(" A job is currently running.") : ''}</p>
    </form>}
    {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
    {runner?.enabled && query.isPending && <p role="status">{translateText("Loading CI history…")}</p>}
    {query.isSuccess && runs.length === 0 && <p className="rounded-xl border p-6 text-sm text-muted-foreground">{translateText("No CI jobs yet. Submit a branch, PR or commit to start.")}</p>}
    {runs.length > 0 && <div className="grid gap-4 xl:grid-cols-[minmax(220px,300px)_minmax(0,1fr)]">
      <div className="space-y-2 xl:hidden"><Label htmlFor="ci-run-history">{translateText("CI job")}</Label><select id="ci-run-history" value={selected?.run_id ?? ''} onChange={(event) => { setSelectedId(event.target.value); setStage(''); }} className="h-9 w-full rounded-md border bg-background px-3 text-sm">{runs.map((run) => <option key={run.run_id} value={run.run_id}>{run.ref} · {statusLabel(run.status)} · {run.sha?.slice(0, 8) || run.run_id}</option>)}</select></div>
      <div className="hidden max-h-[650px] space-y-2 overflow-y-auto rounded-xl border p-3 xl:block" aria-label={translateText("CI history")}>{runs.map((run) => <button key={run.run_id} type="button" aria-pressed={selected?.run_id === run.run_id} onClick={() => { setSelectedId(run.run_id); setStage(''); }} className={`w-full rounded-lg border p-3 text-left text-sm ${selected?.run_id === run.run_id ? 'border-primary bg-accent' : 'hover:bg-accent'}`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="break-all font-medium">{run.ref}</span><Badge variant={['failed', 'infrastructure_error'].includes(run.status) ? 'destructive' : 'secondary'}>{statusLabel(run.status)}</Badge></div>
        <div className="font-mono text-xs text-muted-foreground">{run.sha?.slice(0, 12) || translateText("Resolving commit…")} · {run.stages.length} {translateText("stages")}</div>
        {run.created_at && <time className="text-xs text-muted-foreground" dateTime={new Date(run.created_at * 1000).toISOString()}>{new Date(run.created_at * 1000).toLocaleString()}</time>}
      </button>)}</div>
      {selected && <section className="min-w-0 space-y-4 rounded-xl border bg-card p-4" aria-label={translateText("CI result")}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-medium">{selected.ref} · {statusLabel(selected.status)}</h2>{active && canRun && <Button type="button" variant="outline" onClick={() => void cancel()} disabled={cancelling}>{cancelling ? translateText("Requesting cancellation…") : translateText("Cancel job")}</Button>}</div>
        <p className="break-all font-mono text-xs text-muted-foreground">{selected.sha || translateText("Commit not resolved yet")}</p>
        {selected.status === 'infrastructure_error' && <Alert variant="destructive"><AlertDescription>{selected.failure_reason ? translateText(selected.failure_reason) : translateText("The environment could not complete this job. This is not a passing check; inspect the log before retrying.")}</AlertDescription></Alert>}
        {selected.local_stack_mode === 'fake' && <Alert><AlertDescription>{translateText("Local stack used fake engines. It verifies the application wiring, not real engine analysis.")}</AlertDescription></Alert>}
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2">{translateText('Stage')}</th><th>{translateText('Result')}</th><th>{translateText('Duration')}</th><th>{translateText("Peak memory")}</th></tr></thead><tbody>{selected.stages.map((item) => <tr key={item.name} className="border-b"><th scope="row" className="py-2 text-left font-normal">{item.name}</th><td>{statusLabel(item.result)}</td><td>{item.seconds === null ? '—' : `${item.seconds.toFixed(1)}s`}</td><td>{item.peak_mem_mb === null ? '—' : `${Math.round(item.peak_mem_mb)} MiB${item.sampled_memory ? ' (sampled)' : ''}`}</td></tr>)}</tbody></table></div>
        <div className="space-y-2"><Label htmlFor="ci-log-stage">Log</Label><select id="ci-log-stage" value={stage} onChange={(event) => setStage(event.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm"><option value="">{translateText("All stages")}</option>{selected.stages.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select>
          {log.error && <p role="alert" className="text-sm text-destructive">{log.error}</p>}
          {log.loading && !log.text && <p role="status" className="text-sm">{translateText("Loading log…")}</p>}
          <pre tabIndex={0} aria-label={translateText("CI log")} className="max-h-[450px] overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap break-all">{log.text || (!log.loading && !log.error ? translateText("No log output yet.") : '')}</pre>
          {log.limited && <p className="text-xs text-muted-foreground">{translateText("Log preview is limited to 256 KiB. Select a stage for a smaller preview.")}</p>}
        </div>
      </section>}
    </div>}
  </Container></>;
}
