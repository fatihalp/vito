import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Editor, useMonaco } from '@monaco-editor/react';
import ServerLayout from '@/layouts/server/layout';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckIcon,
  FileCode2Icon,
  HistoryIcon,
  InfoIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  PlusIcon,
  SaveIcon,
  SlidersHorizontalIcon,
  XIcon,
} from 'lucide-react';
import { Server } from '@/types/server';
import { Site } from '@/types/site';
import { useAppearance } from '@/hooks/use-appearance';
import { registerDotEnvLanguage } from '@/lib/editor';
import { EnvVariable } from '@/types/env';
import EnvVariableRow from '@/pages/application/components/env-variable-row';
import EnvHistory from '@/pages/application/components/env-history';
import { generateUniqueKey } from '@/lib/env';
import { cn, rowId } from '@/lib/utils';
import { errorMessage } from '@/lib/errors';

type ParsedVariable = { key: string; value: string; is_secret: boolean; managed_by?: string };

const defaultEnvPath = (site: Site): string => site.type_data?.env_path || (site.path ? `${site.path}/.env` : '/.env');

const toVariables = (parsed: ParsedVariable[], isNew = true): EnvVariable[] =>
  parsed.map((v) => ({
    id: rowId(),
    key: v.key,
    value: v.value,
    isSecret: v.is_secret,
    isNew,
    managedBy: v.managed_by,
  }));

const preserveManagedVariables = (next: EnvVariable[], current: EnvVariable[]): EnvVariable[] => {
  const managed = new Map(current.filter((variable) => variable.managedBy).map((variable) => [variable.key, variable]));
  const merged = next.map((variable) => managed.get(variable.key) ?? variable);
  const nextKeys = new Set(next.map((variable) => variable.key));

  return [...merged, ...Array.from(managed.values()).filter((variable) => !nextKeys.has(variable.key))];
};

function EnvironmentEditorContent() {
  const page = usePage<{
    server: Server;
    site: Site;
  }>();

  const { server, site } = page.props;
  const envPath = defaultEnvPath(site);
  const { getActualAppearance } = useAppearance();
  const monaco = useMonaco();

  const [variables, setVariables] = useState<EnvVariable[]>([]);
  const [rawContent, setRawContent] = useState('');
  const [mode, setMode] = useState<'classic' | 'variables'>('variables');
  const [variablesDirty, setVariablesDirty] = useState(false);
  const [rawDirty, setRawDirty] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [canEdit, setCanEdit] = useState<boolean | undefined>(undefined);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [filterDuplicatesOnly, setFilterDuplicatesOnly] = useState(false);

  const form = useForm<{ path: string; env?: string; variables?: Array<{ key: string; value: string; is_secret: boolean }> }>({
    path: envPath,
  });

  const query = useQuery({
    queryKey: ['siteEnv', site.id, envPath],
    queryFn: async () => {
      const response = await axios.get(`/servers/${server.id}/sites/${site.id}/env`, {
        params: { env: envPath },
      });
      setCanEdit(response.data?.can_edit ?? false);
      setRawContent(response.data?.env ?? '');
      setVariables(toVariables(response.data?.variables ?? [], false));
      setVariablesDirty(false);
      setRawDirty(false);
      return response.data;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (monaco) {
      registerDotEnvLanguage(monaco);
    }
  }, [monaco]);

  const duplicateDetails = useMemo(() => {
    const map = new Map<string, Array<{ index: number; value: string; isSecret: boolean }>>();
    variables.forEach((variable, index) => {
      const trimmed = variable.key.trim();
      if (!trimmed) return;
      if (!map.has(trimmed)) {
        map.set(trimmed, []);
      }
      map.get(trimmed)!.push({ index, value: variable.value, isSecret: variable.isSecret });
    });

    const duplicates = new Map<string, Array<{ index: number; value: string; isSecret: boolean }>>();
    for (const [key, entries] of map.entries()) {
      if (entries.length > 1) {
        duplicates.set(key, entries);
      }
    }
    return duplicates;
  }, [variables]);

  const duplicateKeys = useMemo(() => new Set(duplicateDetails.keys()), [duplicateDetails]);
  const hasDuplicates = duplicateKeys.size > 0;
  const busy = query.isFetching || isSwitching;
  const isDirty = mode === 'classic' ? rawDirty : variablesDirty;

  useEffect(() => {
    if (filterDuplicatesOnly && !hasDuplicates) {
      setFilterDuplicatesOnly(false);
    }
  }, [filterDuplicatesOnly, hasDuplicates]);

  const executeSave = () => {
    form.transform(() =>
      mode === 'variables'
        ? { variables: variables.map((v) => ({ key: v.key, value: v.value, is_secret: v.isSecret })), path: envPath }
        : { env: rawContent, path: envPath },
    );

    form.put(`/servers/${server.id}/sites/${site.id}/env`, {
      preserveScroll: true,
      onSuccess: () => {
        setVariablesDirty(false);
        setRawDirty(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      },
    });
  };

  const submit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (canEdit !== true || showHistory) {
      return;
    }
    if (mode === 'variables' && variables.length === 0) {
      return;
    }

    if (mode === 'variables' && hasDuplicates) {
      setDuplicateModalOpen(true);
      return;
    }

    executeSave();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (!form.processing && !busy && canEdit === true) {
          submit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [form.processing, busy, canEdit, mode, rawContent, variables, envPath, showHistory]);

  const queryError = useMemo(() => (query.isError ? errorMessage(query.error, 'Failed to read the .env file') : null), [query.isError, query.error]);

  const generateAppKey = () => {
    router.post(
      `/servers/${server.id}/sites/${site.id}/env/generate-key`,
      {},
      {
        preserveScroll: true,
        onStart: () => setGeneratingKey(true),
        onSuccess: () => query.refetch(),
        onFinish: () => setGeneratingKey(false),
      },
    );
  };

  const handleVariableChange = (index: number, updatedVariable: EnvVariable) => {
    setVariablesDirty(true);
    setVariables((prev) => {
      const newVariables = [...prev];
      newVariables[index] = updatedVariable;
      return newVariables;
    });
  };

  const handleVariableDelete = (index: number) => {
    setVariablesDirty(true);
    setVariables((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddVariable = () => {
    setVariablesDirty(true);
    const existingKeys = variables.map((v) => v.key);
    const newKey = generateUniqueKey(existingKeys);
    setVariables((prev) => [
      ...prev,
      {
        id: rowId(),
        key: newKey,
        value: '',
        isSecret: false,
        isNew: true,
      },
    ]);
  };

  const parseRawContent = async (content: string) => {
    const response = await axios.post(
      `/servers/${server.id}/sites/${site.id}/env/parse`,
      { content },
    );

    if (response.data?.representable === false) {
      throw new Error(
        canEdit
          ? 'This file has content the variables form cannot represent, such as a value spanning several lines. Edit it in Classic mode instead.'
          : 'This file has content the variables form cannot represent, such as a value spanning several lines.',
      );
    }

    return (response.data?.variables ?? []) as ParsedVariable[];
  };

  const switchMode = async () => {
    if (mode === 'variables') {
      if (!variablesDirty) {
        setMode('classic');
        return;
      }

      setIsSwitching(true);
      try {
        const response = await axios.post(
          `/servers/${server.id}/sites/${site.id}/env/stringify`,
          {
            variables: variables.map((v) => ({ key: v.key, value: v.value })),
          },
        );
        setRawContent(response.data?.env ?? '');
        setMode('classic');
      } catch {
        void 0;
      } finally {
        setIsSwitching(false);
      }
      return;
    }

    setIsSwitching(true);
    try {
      const parsed = await parseRawContent(rawContent);

      const previous = new Map<string, EnvVariable[]>();
      variables.forEach((v) => {
        previous.set(v.key, [...(previous.get(v.key) ?? []), v]);
      });

      setVariables((current) =>
        preserveManagedVariables(
          parsed.map((v) => {
            const match = previous.get(v.key)?.shift();

            return {
              id: match?.id ?? rowId(),
              key: v.key,
              value: v.value,
              isSecret: match ? match.isSecret : v.is_secret,
              isNew: match ? match.isNew : true,
              managedBy: match?.managedBy,
            };
          }),
          current,
        ),
      );
      setVariablesDirty(false);
      setMode('variables');
    } catch {
      void 0;
    } finally {
      setIsSwitching(false);
    }
  };

  const filteredVariables = useMemo(() => {
    let list = variables;
    if (filterDuplicatesOnly) {
      list = list.filter((v) => duplicateKeys.has(v.key.trim()));
    }
    if (searchFilter.trim()) {
      const term = searchFilter.toLowerCase();
      list = list.filter((v) => v.key.toLowerCase().includes(term) || v.value.toLowerCase().includes(term));
    }
    return list;
  }, [variables, filterDuplicatesOnly, duplicateKeys, searchFilter]);

  return (
    <>
      <Head title={`.env Editor - ${site.domain}`} />

      <Container className="max-w-7xl gap-4 py-5 flex flex-col min-h-[calc(100vh-80px)]">
        <div style={{ position: 'absolute', opacity: 0, height: 0, width: 0, overflow: 'hidden', zIndex: -1 }} aria-hidden="true">
          <input type="text" name="fake_username_trap" tabIndex={-1} autoComplete="off" />
          <input type="password" name="fake_password_trap" tabIndex={-1} autoComplete="off" />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild className="h-9 gap-1.5 cursor-pointer">
              <Link href={`/servers/${server.id}/sites/${site.id}`}>
                <ArrowLeftIcon className="size-4" />
                <span>Back to site</span>
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">Environment Variables</h1>
                {isDirty && (
                  <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-500">
                    Unsaved changes
                  </span>
                )}
                {saveSuccess && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-500 animate-in fade-in">
                    <CheckIcon className="size-3" /> Saved
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{site.domain}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            {canEdit === true && (
              <Button
                type="button"
                variant={showHistory ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setShowHistory((value) => !value)}
                className="h-9 gap-1.5 cursor-pointer text-xs"
              >
                <HistoryIcon className="size-3.5" />
                <span>{showHistory ? 'Back to Editor' : 'History'}</span>
              </Button>
            )}

            {canEdit === true && !showHistory && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={switchMode}
                disabled={busy || (mode === 'variables' && query.isError)}
                className="h-9 gap-1.5 cursor-pointer text-xs"
              >
                {isSwitching ? (
                  <LoaderCircleIcon className="size-3.5 animate-spin" />
                ) : mode === 'variables' ? (
                  <FileCode2Icon className="size-3.5" />
                ) : (
                  <SlidersHorizontalIcon className="size-3.5" />
                )}
                <span>{mode === 'variables' ? 'Classic Editor' : 'Variables Mode'}</span>
              </Button>
            )}

            <Button
              type="button"
              onClick={() => submit()}
              disabled={
                form.processing ||
                busy ||
                showHistory ||
                query.isError ||
                canEdit !== true ||
                (mode === 'variables' && variables.length === 0)
              }
              size="sm"
              className="h-9 px-4 gap-2 cursor-pointer font-semibold shadow-sm text-xs"
            >
              {form.processing ? (
                <LoaderCircleIcon className="size-3.5 animate-spin" />
              ) : (
                <SaveIcon className="size-3.5" />
              )}
              <span>Save .env</span>
              <kbd className="hidden sm:inline-block rounded bg-primary-foreground/20 px-1 py-0.5 text-[10px] font-mono leading-none">
                ⌘S
              </kbd>
            </Button>
          </div>
        </div>

        {queryError && (
          <Alert variant="destructive">
            <AlertCircleIcon className="size-4" />
            <AlertDescription>{queryError}</AlertDescription>
          </Alert>
        )}

        {form.errors && Object.keys(form.errors).length > 0 && (
          <Alert variant="destructive">
            <AlertCircleIcon className="size-4" />
            <AlertDescription>
              {Object.values(form.errors).map((error, i) => (
                <div key={i}>{error}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {mode === 'variables' && !showHistory && hasDuplicates && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-start sm:items-center gap-2.5">
              <AlertTriangleIcon className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                Duplicate keys detected: <span className="font-mono font-semibold">{Array.from(duplicateKeys).join(', ')}</span>.
                You can save anyway, but applications will typically only evaluate the last defined value.
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFilterDuplicatesOnly((prev) => !prev)}
                className="h-7 text-xs bg-background/80 hover:bg-background border-amber-500/30 cursor-pointer"
              >
                {filterDuplicatesOnly ? 'Show all variables' : `Filter duplicates (${duplicateKeys.size})`}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDuplicateModalOpen(true)}
                className="h-7 text-xs hover:bg-amber-500/20 cursor-pointer"
              >
                Inspect details
              </Button>
            </div>
          </div>
        )}

        <Card className="overflow-hidden border flex-1 flex flex-col min-h-[550px]">
          {showHistory ? (
            <EnvHistory
              server={server}
              site={site}
              path={envPath}
              current={query.data?.env ?? ''}
              hasUnsavedChanges={isDirty}
              onRestored={() => void query.refetch()}
            />
          ) : mode === 'classic' ? (
            <div className="flex flex-col flex-1 h-full min-h-[550px]">
              {variables.some((variable) => variable.managedBy) && (
                <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <InfoIcon className="size-4 text-primary shrink-0" />
                  <span>
                    Resource-managed variables (database, redis, mail, etc.) are automatically synchronized with connected resources.
                  </span>
                </div>
              )}

              <div className="w-full flex-1" style={{ minHeight: 550 }}>
                {query.isPending ? (
                  <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 240px)', minHeight: 550 }}>
                    <LoaderCircleIcon className="size-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Editor
                    height="calc(100vh - 240px)"
                    defaultLanguage="dotenv"
                    value={rawContent}
                    onChange={(value) => {
                      setRawContent(value ?? '');
                      setRawDirty(true);
                    }}
                    theme={getActualAppearance() === 'dark' ? 'vs-dark' : 'vs'}
                    options={{
                      fontSize: 14,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      minimap: { enabled: true },
                      automaticLayout: true,
                      readOnly: canEdit === false,
                      wordWrap: 'on',
                    }}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-4 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b">
                <div className="flex items-center gap-2 flex-1 max-w-sm">
                  <Input
                    type="search"
                    placeholder="Filter variables..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    name="env_filter_search"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    className="h-9"
                  />
                  {filterDuplicatesOnly && (
                    <Badge
                      variant="warning"
                      className="gap-1 text-xs shrink-0 cursor-pointer"
                      onClick={() => setFilterDuplicatesOnly(false)}
                    >
                      <span>Duplicates only</span>
                      <XIcon className="size-3" />
                    </Badge>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddVariable}
                  disabled={canEdit === false || isSwitching}
                  className="h-9 gap-1.5 cursor-pointer"
                >
                  <PlusIcon className="size-4" />
                  <span>Add Variable</span>
                </Button>
              </div>

              {query.isPending ? (
                <div className="space-y-3 py-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="h-9 w-48" />
                      <Skeleton className="h-9 flex-1" />
                      <Skeleton className="size-9" />
                    </div>
                  ))}
                </div>
              ) : filteredVariables.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  {searchFilter ? 'No variables match your filter.' : 'This file has no variables.'}
                </div>
              ) : (
                <fieldset disabled={isSwitching || canEdit === false} className="flex flex-col gap-3 py-2">
                  {filteredVariables.map((variable) => {
                    const originalIndex = variables.findIndex((v) => v.id === variable.id);
                    const occurrences = variables.filter((v) => v.key.trim() === variable.key.trim());
                    const isDuplicate = occurrences.length > 1;
                    const occurrenceIndex = isDuplicate ? occurrences.findIndex((v) => v.id === variable.id) : -1;
                    const duplicateInfo = isDuplicate
                      ? {
                          index: occurrenceIndex + 1,
                          total: occurrences.length,
                          isEffective: occurrenceIndex === occurrences.length - 1,
                        }
                      : undefined;

                    return (
                      <EnvVariableRow
                        key={variable.id}
                        variable={variable}
                        revealable={canEdit === true}
                        onChange={(updated) => handleVariableChange(originalIndex, updated)}
                        onDelete={() => handleVariableDelete(originalIndex)}
                        duplicate={duplicateInfo}
                        action={
                          site.type === 'laravel' &&
                          canEdit === true &&
                          !variable.isNew &&
                          variable.key === 'APP_KEY' &&
                          variable.value.trim() === '' && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={generateAppKey}
                              disabled={generatingKey || isDirty}
                              title={isDirty ? 'Save or discard your changes first' : 'Run php artisan key:generate'}
                              className="shrink-0"
                            >
                              {generatingKey ? <LoaderCircleIcon className="size-4 animate-spin" /> : <KeyRoundIcon className="size-4" />}
                              <span>Generate key</span>
                            </Button>
                          )
                        }
                      />
                    );
                  })}
                </fieldset>
              )}
            </div>
          )}
        </Card>

        <Dialog open={duplicateModalOpen} onOpenChange={setDuplicateModalOpen}>
          <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangleIcon className="size-5" />
                <DialogTitle className="text-foreground">Duplicate Keys Detected</DialogTitle>
              </div>
              <DialogDescription className="text-xs pt-1">
                Your environment contains duplicate keys. In PHP and most runtime environments, duplicate keys are evaluated in order and only the <strong>last defined value</strong> takes effect.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto max-h-[42vh] space-y-3 py-2 pr-1">
              {Array.from(duplicateDetails.entries()).map(([key, entries]) => (
                <div key={key} className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-foreground">{key}</span>
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      {entries.length} occurrences
                    </span>
                  </div>
                  <div className="space-y-1 font-mono text-xs">
                    {entries.map((entry, idx) => {
                      const isLast = idx === entries.length - 1;
                      const displayVal = entry.isSecret
                        ? entry.value ? '•••••••• (updated)' : '•••••••• (secret)'
                        : entry.value === '' ? '""' : entry.value;

                      return (
                        <div
                          key={idx}
                          className={cn(
                            'flex items-center justify-between rounded px-2.5 py-1 text-xs',
                            isLast
                              ? 'bg-amber-500/15 border border-amber-500/25 text-foreground font-medium'
                              : 'text-muted-foreground bg-background/60',
                          )}
                        >
                          <span className="truncate max-w-[280px]">
                            #{idx + 1}: {displayVal}
                          </span>
                          <span className="text-[10px] shrink-0 uppercase tracking-wider font-sans font-medium">
                            {isLast ? 'Effective value' : 'Overridden'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDuplicateModalOpen(false);
                  setFilterDuplicatesOnly(true);
                }}
                className="cursor-pointer"
              >
                Review & Edit Duplicates
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setDuplicateModalOpen(false);
                  executeSave();
                }}
                disabled={form.processing}
                className="cursor-pointer font-semibold"
              >
                {form.processing ? (
                  <LoaderCircleIcon className="size-4 animate-spin" />
                ) : (
                  <SaveIcon className="size-4" />
                )}
                <span>Save with Duplicates</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Container>
    </>
  );
}

export default function EnvironmentEditor() {
  return (
    <ServerLayout>
      <EnvironmentEditorContent />
    </ServerLayout>
  );
}
