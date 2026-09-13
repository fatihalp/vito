import React, { useState, useEffect, useMemo } from 'react';
import { router, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import { Site } from '@/types/site';
import { ServerLog } from '@/types/server-log';
import { SharedData } from '@/types';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import { useLogContent } from '@/hooks/use-log-content';
import LogOutput from '@/components/log-output';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import siteHelper from '@/lib/site-helper';
import { isPendingLog } from '@/lib/log';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  RotateCcw,
  Terminal,
  ChevronDown,
  ChevronUp,
  Download,
  Trash2,
  FileText,
} from 'lucide-react';
import { humanizeStep } from '@/lib/utils';
import Logs from '@/pages/server-logs/components/logs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface SiteInstallationProgressProps {
  server: Server;
  site: Site;
}

export default function SiteInstallationProgress({ server, site: initialSite }: SiteInstallationProgressProps) {
  const site = useRealtimeRecord(initialSite, 'site') || initialSite;
  const page = usePage<SharedData>();
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryDialogOpen, setRetryDialogOpen] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDomain, setConfirmDomain] = useState('');
  const [forceDelete, setForceDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleOpenDeleteChange = (open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) {
      setConfirmDomain('');
      setForceDelete(false);
      setDeleteError(null);
    }
  };

  const handleDelete = () => {
    setDeleting(true);
    setDeleteError(null);

    router.delete(route('site-settings.destroy', { server: server.id, site: site.id }), {
      data: {
        domain: confirmDomain,
        force: forceDelete,
      },
      onSuccess: () => {
        siteHelper.storeSite();
        if (page.props.auth?.currentProject) {
          siteHelper.removeRecentSite(page.props.auth.user.id, page.props.auth.currentProject.id, site.server_id, site.id);
        }
        setDeleteDialogOpen(false);
      },
      onError: (errors) => {
        const first = errors && typeof errors === 'object' ? Object.values(errors)[0] : null;
        const message =
          typeof first === 'string'
            ? first
            : Array.isArray(first) && typeof first[0] === 'string'
              ? first[0]
              : 'Could not delete site.';
        setDeleteError(message);
        setDeleting(false);
      },
      onFinish: () => {
        setDeleting(false);
      },
    });
  };

  // Automatically refresh the page once installation finishes and site is ready
  useEffect(() => {
    if (site.status === 'ready') {
      router.reload();
    }
  }, [site.status]);

  const failed = site.status === 'installation_failed';
  const progressPercent = Math.min(100, Math.max(0, site.progress ?? 0));

  // Determine installation steps
  const steps = useMemo(() => {
    if (site.installation_steps && site.installation_steps.length > 0) {
      return site.installation_steps;
    }
    return [
      { key: 'isolating-user', label: 'Isolating User & Environment', percentage: 0 },
      { key: 'installing-tooling', label: 'Installing Runtime Tooling', percentage: 15 },
      { key: 'creating-vhost', label: 'Configuring Web Server VHost', percentage: 20 },
      { key: 'deploying-ssh-key', label: 'Deploying Repository SSH Key', percentage: 25 },
      { key: 'cloning-repository', label: 'Cloning Source Code', percentage: 40 },
      { key: 'restarting-php', label: 'Restarting PHP Runtime', percentage: 60 },
      { key: 'running-auto-install', label: 'Auto-Install & Services', percentage: 70 },
      { key: 'finishing', label: 'Finalizing & Verifying', percentage: 100 },
    ];
  }, [site.installation_steps]);

  const completedSteps: string[] = useMemo(() => {
    const raw = site.type_data?.completed_steps;
    return Array.isArray(raw) ? (raw as string[]) : [];
  }, [site.type_data?.completed_steps]);

  const completedCount = useMemo(() => {
    return steps.filter((s) => completedSteps.includes(s.key) || site.status === 'ready').length;
  }, [steps, completedSteps, site.status]);

  const totalSteps = steps.length;

  // Auto-install command breakdown for Vito sites
  const vitoInstallCommands = useMemo(() => {
    const vitoConfig = site.type_data?.vito_config as { install_commands?: string[] } | undefined;
    if (vitoConfig && Array.isArray(vitoConfig.install_commands)) {
      return vitoConfig.install_commands.filter((c) => typeof c === 'string' && c.trim() !== '');
    }
    return [];
  }, [site.type_data?.vito_config]);

  const completedInstallCommands: string[] = useMemo(() => {
    const raw = site.type_data?.completed_install_commands;
    return Array.isArray(raw) ? (raw as string[]) : [];
  }, [site.type_data?.completed_install_commands]);

  // Composer command editing if relevant
  const canEditComposer =
    site.progress_step === 'installing-composer-dependencies' && !!site.default_composer_install_command;
  const [composerCommand, setComposerCommand] = useState(
    () => site.type_data?.composer_install_command || site.default_composer_install_command || '',
  );

  // Fetch recent site logs
  const logsQuery = useQuery({
    queryKey: ['siteInstallLogs', server.id, site.id],
    queryFn: async () => {
      const res = await axios.get(route('logs.json', { server: server.id, site: site.id }));
      return res.data;
    },
    refetchInterval: site.status === 'installing' ? 3000 : 8000,
  });

  const logsList: ServerLog[] = useMemo(() => {
    return logsQuery.data?.data || [];
  }, [logsQuery.data?.data]);

  // Resolve active log to show in the live terminal
  const activeLogId = useMemo(() => {
    if (selectedLogId !== null && logsList.some((l) => l.id === selectedLogId)) {
      return selectedLogId;
    }
    return logsList.length > 0 ? logsList[0].id : null;
  }, [selectedLogId, logsList]);

  const activeLog = useMemo(() => {
    return logsList.find((l) => l.id === activeLogId) ?? null;
  }, [logsList, activeLogId]);

  // Live log content hook
  const { content: liveLogContent, isLoading: isLogLoading, error: logError } = useLogContent({
    serverId: server.id,
    logId: activeLogId ?? 0,
    enabled: !!activeLogId,
  });

  const handleRetry = () => {
    setRetrying(true);
    setRetryError(null);

    router.post(
      route('sites.retry', { server: server.id, site: site.id }),
      canEditComposer ? { composer_install_command: composerCommand } : {},
      {
        preserveScroll: true,
        onSuccess: () => {
          setRetryDialogOpen(false);
        },
        onError: (errors) => {
          const first = errors && typeof errors === 'object' ? Object.values(errors)[0] : null;
          const message =
            typeof first === 'string'
              ? first
              : Array.isArray(first) && typeof first[0] === 'string'
                ? first[0]
                : 'Could not resume installation. Please check server logs.';
          setRetryError(message);
        },
        onFinish: () => {
          setRetrying(false);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Light Top Section: Title, Badges, Progress, Actions */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">
                {failed ? 'Site installation failed' : 'Installing application'}
              </h2>
              {failed && (
                <Badge
                  variant="destructive"
                  className="text-xs font-normal"
                >
                  Failed
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {failed
                ? 'The installation did not complete. Review the logs below or retry.'
                : `Setting up ${site.domain} · ${completedCount} of ${totalSteps} steps completed`}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Cancel & Delete Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={handleOpenDeleteChange}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5 border-destructive/30 shadow-none cursor-pointer"
                  disabled={deleting || retrying}
                >
                  <Trash2 className="size-3.5" />
                  <span>Cancel & Delete</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel installation & delete site?</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to abandon the installation and delete <strong>{site.domain}</strong>?
                    Any created system files, web server configuration, and user will be removed. This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="confirm-site-domain" className="text-sm">
                      Type{' '}
                      <button
                        type="button"
                        onClick={() => setConfirmDomain(site.domain)}
                        className="font-semibold text-foreground underline decoration-dotted hover:text-primary cursor-pointer"
                        title="Click to auto-fill"
                      >
                        {site.domain}
                      </button>{' '}
                      to confirm:
                    </Label>
                    <Input
                      id="confirm-site-domain"
                      value={confirmDomain}
                      onChange={(e) => setConfirmDomain(e.target.value)}
                      placeholder={site.domain}
                      className="font-mono text-xs"
                      autoComplete="off"
                    />
                  </div>

                  <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/20 p-3">
                    <Checkbox
                      id="force-delete-checkbox"
                      checked={forceDelete}
                      onCheckedChange={(checked) => setForceDelete(!!checked)}
                      className="mt-0.5"
                    />
                    <div className="flex flex-col gap-0.5">
                      <Label htmlFor="force-delete-checkbox" className="cursor-pointer text-xs font-medium">
                        Force delete
                      </Label>
                      <p className="text-muted-foreground text-xs">
                        Remove the site from Vito even if cleaning up files on the remote server fails.
                      </p>
                    </div>
                  </div>

                  {deleteError && (
                    <p className="text-destructive text-xs font-medium">{deleteError}</p>
                  )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    variant="outline"
                    onClick={() => handleOpenDeleteChange(false)}
                    disabled={deleting}
                  >
                    Keep Installation
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={deleting || confirmDomain !== site.domain}
                    onClick={handleDelete}
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="mr-2 size-3.5 animate-spin" />
                        Deleting Site...
                      </>
                    ) : (
                      'Cancel & Delete Site'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Resume / Retry Dialog - only rendered when installation fails */}
            {failed && (
              <Dialog open={retryDialogOpen} onOpenChange={setRetryDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5 shadow-none"
                    disabled={retrying}
                  >
                    <RotateCcw className={cn('size-3.5', retrying && 'animate-spin')} />
                    <span>Retry Installation</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Resume or retry installation?</DialogTitle>
                    <DialogDescription>
                      This will safely re-trigger the installation for <strong>{site.domain}</strong>. All completed
                      steps (system user, vhost, repository clone, ssh keys) are stored and will be skipped.
                    </DialogDescription>
                  </DialogHeader>

                  {canEditComposer && (
                    <div className="space-y-2 py-2">
                      <Label htmlFor="composer-install-cmd">Composer install command</Label>
                      <Textarea
                        id="composer-install-cmd"
                        value={composerCommand}
                        onChange={(e) => setComposerCommand(e.target.value)}
                        className="font-mono text-xs"
                        rows={3}
                      />
                    </div>
                  )}

                  {retryError && <p className="text-destructive text-sm font-medium">{retryError}</p>}

                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => setRetryDialogOpen(false)} disabled={retrying}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleRetry}
                      disabled={retrying}
                    >
                      {retrying ? 'Starting...' : 'Resume Installation'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Sleek Progress Bar */}
        <Progress value={progressPercent} className="h-1.5 w-full transition-all duration-300" />

        {/* Error banner if any */}
        {site.last_error && (
          <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-3 text-xs">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertCircle className="size-4 shrink-0" />
              <span>Last Error</span>
            </div>
            <pre className="mt-1 font-mono whitespace-pre-wrap break-all text-xs opacity-90">{site.last_error}</pre>
          </div>
        )}
      </div>

      {/* Main Grid: Left = Timeline, Right = Terminal */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Step-by-Step Timeline (5 columns on desktop) */}
        <Card className="border-border/60 shadow-none lg:col-span-5">
          <CardHeader className="p-3.5 border-b flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold">Installation Steps</CardTitle>
            <span className="text-xs text-muted-foreground font-mono">
              {completedCount}/{totalSteps}
            </span>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-col">
              {steps.map((s, index) => {
                const isStepCompleted = completedSteps.includes(s.key) || site.status === 'ready';
                const isStepFailed = failed && site.progress_step === s.key;
                const isStepActive = !isStepCompleted && !isStepFailed && site.progress_step === s.key;
                const isStepPending = !isStepCompleted && !isStepFailed && !isStepActive;

                return (
                  <div key={s.key} className="flex gap-3 relative py-2.5 first:pt-0 last:pb-0">
                    {/* Vertical connecting line */}
                    {index < steps.length - 1 && (
                      <div
                        className={cn(
                          'absolute left-[9px] top-6 bottom-0 w-px',
                          isStepCompleted ? 'bg-emerald-500/30' : 'bg-border/60'
                        )}
                      />
                    )}

                    {/* Step Icon */}
                    <div className="relative z-10 flex size-5 shrink-0 items-center justify-center bg-card">
                      {isStepCompleted ? (
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      ) : isStepActive ? (
                        <Loader2 className="size-4 text-primary animate-spin" />
                      ) : isStepFailed ? (
                        <AlertCircle className="size-4 text-destructive" />
                      ) : (
                        <div className="size-1.5 rounded-full bg-muted-foreground/30" />
                      )}
                    </div>

                    {/* Step content */}
                    <div className="flex flex-1 flex-col min-w-0 justify-center">
                      <span
                        className={cn(
                          'text-xs leading-snug',
                          isStepActive && 'font-semibold text-primary',
                          isStepFailed && 'font-semibold text-destructive',
                          isStepCompleted && 'font-medium text-foreground',
                          isStepPending && 'text-muted-foreground'
                        )}
                      >
                        {index + 1}. {s.label}
                      </span>

                      {/* Vito Sub-commands compact view */}
                      {s.key === 'running-auto-install' && vitoInstallCommands.length > 0 && (
                        <div className="mt-2 ml-1 flex flex-col gap-1 border-l pl-2.5">
                          {vitoInstallCommands.map((cmd, cmdIdx) => {
                            const isCmdDone = completedInstallCommands.includes(cmd);
                            const isCmdActive =
                              isStepActive &&
                              !isCmdDone &&
                              (cmdIdx === 0 || completedInstallCommands.includes(vitoInstallCommands[cmdIdx - 1]));

                            return (
                              <div
                                key={cmdIdx}
                                className={cn(
                                  'flex items-center gap-1.5 text-[11px] font-mono leading-tight truncate',
                                  isCmdDone && 'text-muted-foreground line-through opacity-70',
                                  isCmdActive && 'text-primary font-medium',
                                  !isCmdDone && !isCmdActive && 'text-muted-foreground/50'
                                )}
                                title={cmd}
                              >
                                {isCmdDone ? (
                                  <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                                ) : isCmdActive ? (
                                  <Loader2 className="size-3 text-primary animate-spin shrink-0" />
                                ) : (
                                  <div className="size-1 rounded-full bg-muted-foreground/40 shrink-0" />
                                )}
                                <span className="truncate">{cmd}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Live Terminal (7 columns on desktop) */}
        <Card className="border-border/60 shadow-none flex flex-col lg:col-span-7">
          <CardHeader className="p-3.5 border-b flex flex-row items-center justify-between gap-3 space-y-0">
            <div className="flex items-center gap-2 min-w-0">
              <Terminal className="size-4 text-muted-foreground shrink-0" />
              <CardTitle className="text-sm font-semibold truncate">
                {activeLog ? activeLog.name : 'Installation Output'}
              </CardTitle>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {logsList.length > 1 && (
                <Select
                  value={activeLogId ? String(activeLogId) : ''}
                  onValueChange={(val) => setSelectedLogId(Number(val))}
                >
                  <SelectTrigger className="h-7 text-xs w-44">
                    <SelectValue placeholder="Select log..." />
                  </SelectTrigger>
                  <SelectContent>
                    {logsList.map((log) => (
                      <SelectItem key={log.id} value={String(log.id)} className="text-xs">
                        {humanizeStep(log.name) || log.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {activeLog && (
                <Button variant="ghost" size="icon" className="size-7" asChild>
                  <a
                    href={route('logs.download', { server: server.id, log: activeLog.id })}
                    target="_blank"
                    rel="noreferrer"
                    title="Download log"
                  >
                    <Download className="size-3.5" />
                  </a>
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1 flex flex-col">
            {activeLogId ? (
              <LogOutput className="h-[460px] w-full rounded-none border-0 font-mono text-xs">
                {logError ? (
                  <span className="text-destructive">{logError}</span>
                ) : (isLogLoading && !liveLogContent) || isPendingLog(liveLogContent) ? (
                  <div className="flex h-full min-h-[220px] w-full items-center justify-center py-10">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  liveLogContent || 'No output recorded yet.'
                )}
              </LogOutput>
            ) : (
              <div className="text-muted-foreground flex h-[460px] items-center justify-center p-6 text-sm">
                {logsQuery.isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    <span>Checking for logs...</span>
                  </div>
                ) : (
                  <span>No installation logs found yet.</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Historical Logs Collapsible Accordion */}
      <Collapsible open={showAllLogs} onOpenChange={setShowAllLogs} className="rounded-xl border border-border/60 shadow-none">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-3.5 h-auto text-xs font-medium hover:bg-muted/30"
          >
            <div className="flex items-center gap-2">
              <FileText className="size-3.5 text-muted-foreground" />
              <span>All Installation Logs</span>
              <Badge variant="gray" className="text-[10px] px-1.5 py-0 h-4">
                {logsList.length}
              </Badge>
            </div>
            {showAllLogs ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t p-4">
          <Logs server={server} site={site} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
