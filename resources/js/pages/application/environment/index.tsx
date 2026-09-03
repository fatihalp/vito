import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Editor, useMonaco } from '@monaco-editor/react';
import ServerLayout from '@/layouts/server/layout';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckIcon,
  FileCode2Icon,
  InfoIcon,
  LoaderCircleIcon,
  PlusIcon,
  SaveIcon,
  SlidersHorizontalIcon,
} from 'lucide-react';
import { Server } from '@/types/server';
import { Site } from '@/types/site';
import { useAppearance } from '@/hooks/use-appearance';
import { registerDotEnvLanguage } from '@/lib/editor';
import { EnvVariable } from '@/types/env';
import EnvVariableRow from '@/pages/application/components/env-variable-row';
import { generateUniqueKey } from '@/lib/env';
import { rowId } from '@/lib/utils';
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

  const form = useForm<{ path: string; env?: string; variables?: Array<{ key: string; value: string; is_secret: boolean }> }>({
    path: envPath,
  });

  const query = useQuery({
    queryKey: ['siteEnv', site.id, envPath],
    queryFn: async () => {
      const response = await axios.get(route('application.env', { server: server.id, site: site.id }), {
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

  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const variable of variables) {
      const trimmed = variable.key.trim();
      if (!trimmed) continue;
      counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
    }
    const dupes = new Set<string>();
    for (const [key, count] of counts) {
      if (count > 1) dupes.add(key);
    }
    return dupes;
  }, [variables]);

  const hasDuplicates = duplicateKeys.size > 0;
  const busy = query.isFetching || isSwitching;
  const isDirty = mode === 'classic' ? rawDirty : variablesDirty;

  const submit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (canEdit !== true) {
      return;
    }
    if (mode === 'variables' && (hasDuplicates || variables.length === 0)) {
      return;
    }

    form.transform(() =>
      mode === 'variables'
        ? { variables: variables.map((v) => ({ key: v.key, value: v.value, is_secret: v.isSecret })), path: envPath }
        : { env: rawContent, path: envPath },
    );

    form.put(route('application.update-env', { server: server.id, site: site.id }), {
      preserveScroll: true,
      onSuccess: () => {
        setVariablesDirty(false);
        setRawDirty(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      },
    });
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
  }, [form.processing, busy, canEdit, mode, rawContent, variables, envPath]);

  const queryError = useMemo(() => (query.isError ? errorMessage(query.error, 'Failed to read the .env file') : null), [query.isError, query.error]);

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
      route('application.parse-env', {
        server: server.id,
        site: site.id,
      }),
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
          route('application.stringify-env', {
            server: server.id,
            site: site.id,
          }),
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
    if (!searchFilter.trim()) return variables;
    const term = searchFilter.toLowerCase();
    return variables.filter((v) => v.key.toLowerCase().includes(term) || v.value.toLowerCase().includes(term));
  }, [variables, searchFilter]);

  return (
    <>
      <Head title={`.env Editor - ${site.domain}`} />

      <Container className="max-w-7xl gap-4 py-5 flex flex-col min-h-[calc(100vh-80px)]">
        {/* Hidden decoy fields to absorb browser credential autofill */}
        <div style={{ position: 'absolute', opacity: 0, height: 0, width: 0, overflow: 'hidden', zIndex: -1 }} aria-hidden="true">
          <input type="text" name="fake_username_trap" tabIndex={-1} autoComplete="off" />
          <input type="password" name="fake_password_trap" tabIndex={-1} autoComplete="off" />
        </div>

        {/* Top bar with navigation and actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild className="h-9 gap-1.5 cursor-pointer">
              <Link href={route('application', { server: server.id, site: site.id })}>
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
                query.isError ||
                canEdit !== true ||
                (mode === 'variables' && (hasDuplicates || variables.length === 0))
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

        {/* Alerts */}
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

        {/* Main Editor / Variables Area */}
        <Card className="overflow-hidden border flex-1 flex flex-col min-h-[550px]">
          {mode === 'classic' ? (
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
                    return (
                      <EnvVariableRow
                        key={variable.id}
                        variable={variable}
                        revealable={canEdit === true}
                        onChange={(updated) => handleVariableChange(originalIndex, updated)}
                        onDelete={() => handleVariableDelete(originalIndex)}
                        error={duplicateKeys.has(variable.key.trim()) ? 'Duplicate key' : undefined}
                      />
                    );
                  })}
                </fieldset>
              )}
            </div>
          )}
        </Card>
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
